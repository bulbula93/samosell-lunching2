"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const DISMISS_KEY = "samosell:pwa-install-dismissed-at"
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function isIosDevice() {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function wasRecentlyDismissed() {
  try {
    const value = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0)
    return Number.isFinite(value) && value > 0 && Date.now() - value < DISMISS_FOR_MS
  } catch {
    return false
  }
}

export default function PwaInstallPrompt() {
  const pathname = usePathname()
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [ios, setIos] = useState(false)
  const [showIosSteps, setShowIosSteps] = useState(false)

  const eligibleRoute =
    pathname === "/" ||
    pathname === "/catalog" ||
    pathname.startsWith("/listing/")

  useEffect(() => {
    if (!eligibleRoute || isStandalone() || wasRecentlyDismissed()) return

    const media = window.matchMedia("(max-width: 767px)")
    if (!media.matches) return

    const iosDevice = isIosDevice()
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setIos(iosDevice)
    })

    let timer: ReturnType<typeof setTimeout> | null = null

    const reveal = () => {
      timer = setTimeout(() => {
        if (!isStandalone() && !wasRecentlyDismissed()) setVisible(true)
      }, 6500)
    }

    const beforeInstall = (rawEvent: Event) => {
      const event = rawEvent as BeforeInstallPromptEvent
      event.preventDefault()
      setPromptEvent(event)
      reveal()
    }

    const onInstalled = () => {
      setVisible(false)
      setPromptEvent(null)
      setShowIosSteps(false)
    }

    window.addEventListener("beforeinstallprompt", beforeInstall)
    window.addEventListener("appinstalled", onInstalled)

    // Safari on iOS has no beforeinstallprompt event, so provide manual steps.
    if (iosDevice) reveal()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      window.removeEventListener("beforeinstallprompt", beforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [eligibleRoute])

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // Dismissal is still effective for the current render when storage is unavailable.
    }
    setVisible(false)
    setShowIosSteps(false)
  }

  async function install() {
    if (ios) {
      setShowIosSteps(true)
      return
    }
    if (!promptEvent) return

    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === "accepted") {
      setVisible(false)
    } else {
      dismiss()
    }
    setPromptEvent(null)
  }

  if (!eligibleRoute || !visible || (!ios && !promptEvent)) return null

  return (
    <aside
      aria-label="SamoSell აპის დაყენება"
      className="fixed inset-x-3 z-[64] mx-auto max-w-md rounded-2xl border border-line bg-white/97 p-3 shadow-[0_18px_55px_rgba(7,63,59,0.2)] backdrop-blur md:hidden"
      style={{
        bottom: "calc(var(--mobile-nav-offset) + env(safe-area-inset-bottom) + 0.75rem)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-brand-soft">
          <Image src="/apple-icon.png" alt="" fill sizes="44px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-text">დააყენე SamoSell ტელეფონზე</p>
          <p className="mt-1 text-xs leading-5 text-text-soft">
            გაიხსნება აპივით, ცალკე ფანჯარაში და Home Screen-იდან ერთი შეხებით.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="დაყენების შეთავაზების დახურვა"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-text-soft transition hover:bg-surface-alt"
        >
          ×
        </button>
      </div>

      {showIosSteps ? (
        <div className="mt-3 rounded-xl bg-surface-alt px-3 py-2.5 text-xs leading-5 text-text">
          Safari-ში დააჭირე <strong>Share</strong> → <strong>Add to Home Screen</strong> → <strong>Add</strong>.
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={install} className="ui-btn-primary min-h-10 flex-1 py-2">
          {ios ? "როგორ დავაყენო" : "აპის დაყენება"}
        </button>
        <button type="button" onClick={dismiss} className="ui-btn-secondary min-h-10 px-4 py-2">
          მოგვიანებით
        </button>
      </div>
    </aside>
  )
}
