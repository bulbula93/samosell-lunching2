"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function useUnreadNotifications(userId: string | null | undefined, initialCount: number, initialChatCount = 0) {
  const [count, setCount] = useState({ notifications: initialCount, chats: initialChatCount })
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    let cancelled = false
    let running = false
    let queued = false
    const refresh = async () => {
      if (cancelled || document.visibilityState === "hidden") return
      if (running) { queued = true; return }
      running = true
      try {
        const query = () => supabase.from("notifications")
          .select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null)
        const [general, chats] = await Promise.all([
          query().not("type", "in", "(chat_started,chat_message)"),
          query().in("type", ["chat_started", "chat_message"]),
        ])
        if (!cancelled && !general.error && !chats.error) setCount({ notifications: general.count ?? 0, chats: chats.count ?? 0 })
      } catch { /* Keep the last confirmed count during a connection failure. */ }
      finally {
        running = false
        if (queued && !cancelled) { queued = false; void refresh() }
      }
    }
    const channel = supabase.channel(`notification-count:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => { void refresh() })
      .subscribe((status) => { if (status === "SUBSCRIBED") void refresh() })
    void refresh()
    const onFocus = () => { void refresh() }
    // Recover missed events after offline/sleep, or when Realtime is unavailable.
    const timer = window.setInterval(onFocus, 30_000)
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onFocus)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
      void supabase.removeChannel(channel)
    }
  }, [userId, initialCount, initialChatCount])
  return count
}
