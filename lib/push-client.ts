// Browser-side Web Push helpers shared by the notification settings page and
// the post-publish opt-in step. No server work beyond the existing
// /api/push/subscription route.

type PushConfigResponse = {
  vapidPublicKey?: string
  subscribed?: boolean
}

export type PushEnvironment = {
  /** serviceWorker + PushManager + Notification exist in this browser. */
  supported: boolean
  permission: NotificationPermission
  ios: boolean
  /** Opened from the Home Screen (required for Web Push on iPhone). */
  standalone: boolean
}

export type PushEnableResult = "enabled" | "denied" | "dismissed" | "failed"

export function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const normalized = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(normalized)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

export function isIosDevice() {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

export function readPushEnvironment(): PushEnvironment {
  return {
    supported: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    permission: "Notification" in window ? Notification.permission : "default",
    ios: isIosDevice(),
    standalone:
      window.matchMedia?.("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  }
}

/** VAPID key for the signed-in user ("" when push is not configured or the user is signed out). */
export async function fetchPushConfig(): Promise<{ vapidPublicKey: string }> {
  try {
    const response = await fetch("/api/push/subscription", { credentials: "same-origin" })
    if (!response.ok) return { vapidPublicKey: "" }
    const config = (await response.json()) as PushConfigResponse
    return { vapidPublicKey: config.vapidPublicKey ?? "" }
  } catch {
    return { vapidPublicKey: "" }
  }
}

export async function hasBrowserPushSubscription() {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    return Boolean(await registration.pushManager.getSubscription())
  } catch {
    return false
  }
}

/** Asks the browser for permission, subscribes and stores the subscription for the signed-in user. */
export async function enablePushSubscription(vapidPublicKey: string): Promise<PushEnableResult> {
  try {
    const permission = await Notification.requestPermission()
    if (permission === "denied") return "denied"
    if (permission !== "granted") return "dismissed"

    await navigator.serviceWorker.register("/sw.js", { scope: "/" })
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
    return response.ok ? "enabled" : "failed"
  } catch {
    return "failed"
  }
}
