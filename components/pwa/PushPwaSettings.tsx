"use client"

import { useEffect, useMemo, useState } from "react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

type PushConfigResponse = {
  vapidPublicKey?: string
  subscribed?: boolean
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const normalized = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(normalized)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

function isIosDevice() {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

export default function PushPwaSettings() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [subscribed, setSubscribed] = useState(false)
  const [vapidPublicKey, setVapidPublicKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
    setSupported(pushSupported)
    setPermission("Notification" in window ? Notification.permission : "default")
    setIos(isIosDevice())
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    )

    const beforeInstall = (rawEvent: Event) => {
      const event = rawEvent as BeforeInstallPromptEvent
      event.preventDefault()
      setInstallPrompt(event)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", beforeInstall)
    window.addEventListener("appinstalled", onInstalled)

    if (pushSupported) {
      void Promise.all([
        navigator.serviceWorker.register("/sw.js", { scope: "/" }),
        fetch("/api/push/subscription", { credentials: "same-origin" })
          .then(async (response) => (response.ok ? (await response.json()) as PushConfigResponse : {}))
          .catch(() => ({} as PushConfigResponse)),
      ]).then(async ([registration, config]) => {
        setVapidPublicKey(config.vapidPublicKey ?? "")
        const browserSubscription = await registration.pushManager.getSubscription()
        setSubscribed(Boolean(browserSubscription))
      })
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const iosNeedsInstall = ios && !installed
  const canEnablePush = supported && !iosNeedsInstall && permission !== "denied" && Boolean(vapidPublicKey)

  const pushStatus = useMemo(() => {
    if (!supported) return "ამ browser-ში Web Push მიუწვდომელია"
    if (permission === "denied") return "Browser-ში notification permission დაბლოკილია"
    if (iosNeedsInstall) return "iPhone-ზე ჯერ Home Screen-ზე დაამატე SamoSell"
    if (subscribed) return "Push შეტყობინებები ჩართულია"
    return "Push შეტყობინებები გამორთულია"
  }, [iosNeedsInstall, permission, subscribed, supported])

  async function enablePush() {
    if (!canEnablePush) return
    setBusy(true)
    setMessage("")
    try {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== "granted") {
        setMessage(nextPermission === "denied" ? "Notification permission დაიბლოკა browser-ის პარამეტრებში." : "Push არ ჩაირთო.")
        return
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }

      const response = await fetch("/api/push/subscription", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!response.ok) throw new Error("subscription_sync_failed")

      setSubscribed(true)
      setMessage("Push ჩართულია ამ მოწყობილობაზე.")
    } catch {
      setMessage("Push-ის ჩართვა ვერ დასრულდა. სცადე თავიდან.")
    } finally {
      setBusy(false)
    }
  }

  async function disablePush() {
    if (!("serviceWorker" in navigator)) return
    setBusy(true)
    setMessage("")
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const response = await fetch("/api/push/subscription", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        if (!response.ok) throw new Error("subscription_delete_failed")
        await subscription.unsubscribe()
      }
      setSubscribed(false)
      setMessage("Push გამორთულია ამ მოწყობილობაზე.")
    } catch {
      setMessage("Push-ის გამორთვა ვერ დასრულდა. სცადე თავიდან.")
    } finally {
      setBusy(false)
    }
  }

  async function installApp() {
    if (!installPrompt) return
    setBusy(true)
    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === "accepted") setMessage("SamoSell-ის დაყენება დაიწყო.")
      setInstallPrompt(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-6 grid gap-4 lg:grid-cols-2" aria-label="აპისა და Push შეტყობინებების პარამეტრები">
      <article className="ui-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="ui-eyebrow">Web Push</p>
            <h2 className="mt-2 text-xl font-black text-text">მნიშვნელოვანი შეტყობინებები ტელეფონზე</h2>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${subscribed ? "bg-emerald-50 text-emerald-900" : "bg-surface-alt text-text-soft"}`}>
            {subscribed ? "ON" : "OFF"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-text-soft">
          მიიღე ახალი ჩათის, ფასის შეთავაზების, ჯავშნის, შენახული ძებნის შესაბამისობის და ფავორიტის ფასის შემცირების Push შეტყობინებები.
        </p>
        <p className="mt-3 text-xs font-bold text-text-soft">{pushStatus}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {subscribed ? (
            <button type="button" className="ui-btn-secondary" onClick={disablePush} disabled={busy}>
              Push-ის გამორთვა
            </button>
          ) : (
            <button type="button" className="ui-btn-primary" onClick={enablePush} disabled={busy || !canEnablePush}>
              {busy ? "იტვირთება…" : "Push-ის ჩართვა"}
            </button>
          )}
        </div>
        {message ? <p className="mt-3 text-xs font-semibold text-text-soft" role="status">{message}</p> : null}
      </article>

      <article className="ui-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="ui-eyebrow">PWA</p>
            <h2 className="mt-2 text-xl font-black text-text">დააყენე SamoSell აპივით</h2>
          </div>
          {installed ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-900">დაყენებულია</span> : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-text-soft">
          Home Screen-იდან გაიხსნება standalone რეჟიმში, ჩვეულებრივი აპის მსგავსად.
        </p>
        <div className="mt-5">
          {installed ? (
            <p className="text-sm font-bold text-text">SamoSell უკვე standalone რეჟიმშია.</p>
          ) : installPrompt ? (
            <button type="button" className="ui-btn-primary" onClick={installApp} disabled={busy}>
              აპის დაყენება
            </button>
          ) : ios ? (
            <div className="rounded-xl bg-surface-alt p-4 text-sm leading-6 text-text-soft">
              Safari-ში დააჭირე <strong>Share</strong> ღილაკს → <strong>Add to Home Screen</strong>. შემდეგ გახსენი SamoSell Home Screen-იდან და Push-ის ჩართვა ხელმისაწვდომი გახდება.
            </div>
          ) : (
            <div className="rounded-xl bg-surface-alt p-4 text-sm leading-6 text-text-soft">
              Browser-ის მენიუში აირჩიე <strong>Install app</strong> ან <strong>Add to Home Screen</strong>. როცა browser install prompt-ს შემოგთავაზებს, აქაც გამოჩნდება დაყენების ღილაკი.
            </div>
          )}
        </div>
      </article>
    </section>
  )
}
