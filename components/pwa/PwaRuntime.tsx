"use client"

import { useEffect } from "react"

export default function PwaRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    let cancelled = false

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (registration) => {
        if (cancelled) return
        if (!("Notification" in window) || Notification.permission !== "granted") return
        if (!("PushManager" in window)) return

        const subscription = await registration.pushManager.getSubscription()
        if (!subscription || cancelled) return

        await fetch("/api/push/subscription", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        }).catch(() => null)
      })
      .catch(() => null)

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
