"use client"

import { useEffect, useEffectEvent, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export const NOTIFICATION_FALLBACK_MS = 300_000
export const NOTIFICATION_DISCONNECTED_MS = 60_000
const FOCUS_COOLDOWN_MS = 5_000
type Counts = { notifications: number; chats: number }
type Listener = (counts: Counts) => void

// One recipient-scoped channel and refresh loop per browser app, even when
// multiple responsive shells consume the badges. Never shared across tabs/users.
const stores = new Map<string, ReturnType<typeof createStore>>()

function createStore(userId: string, initial: Counts) {
  const supabase = createClient()
  const listeners = new Set<Listener>()
  let counts = initial
  let cancelled = false
  let running = false
  let dirty = false
  let subscribed = false
  let lastRefresh = -Infinity
  let timer: number | undefined
  let eventTimer: number | undefined

  const visible = () => document.visibilityState !== "hidden"
  const clearTimer = () => { window.clearTimeout(timer); timer = undefined }
  const schedule = () => {
    clearTimer()
    if (!cancelled && visible()) {
      timer = window.setTimeout(() => { void refresh() }, subscribed ? NOTIFICATION_FALLBACK_MS : NOTIFICATION_DISCONNECTED_MS)
    }
  }
  const refresh = async () => {
    if (cancelled || !visible() || running) return
    running = true
    dirty = false
    lastRefresh = Date.now()
    clearTimer()
    try {
      const query = () => supabase.from("notifications")
        .select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null)
      const [general, chats] = await Promise.all([
        query().not("type", "in", "(chat_started,chat_message)"),
        query().in("type", ["chat_started", "chat_message"]),
      ])
      if (!cancelled && !general.error && !chats.error) {
        counts = { notifications: general.count ?? 0, chats: chats.count ?? 0 }
        listeners.forEach((listener) => listener(counts))
      }
    } catch { /* Keep the last confirmed count during connection failures. */ }
    finally {
      running = false
      if (dirty && !cancelled && visible()) requestEventRefresh()
      schedule()
    }
  }
  const requestEventRefresh = () => {
    dirty = true
    if (cancelled || !visible() || running || eventTimer !== undefined) return
    // Coalesce bursts (for example mark-all-read) into one pair of counts.
    eventTimer = window.setTimeout(() => {
      eventTimer = undefined
      void refresh()
    }, 100)
  }
  const onFocus = () => {
    if (!visible()) {
      clearTimer()
      window.clearTimeout(eventTimer)
      eventTimer = undefined
      return
    }
    if (dirty || Date.now() - lastRefresh >= FOCUS_COOLDOWN_MS) void refresh()
    else schedule()
  }
  const channel = supabase.channel(`notification-count:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, requestEventRefresh)
    .subscribe((status) => {
      if (cancelled) return
      const wasSubscribed = subscribed
      subscribed = status === "SUBSCRIBED"
      if (subscribed && !wasSubscribed && Date.now() - lastRefresh >= FOCUS_COOLDOWN_MS) void refresh()
      schedule()
    })
  void refresh()
  window.addEventListener("focus", onFocus)
  document.addEventListener("visibilitychange", onFocus)

  return {
    add(listener: Listener) { listeners.add(listener); listener(counts) },
    remove(listener: Listener) { listeners.delete(listener); return listeners.size },
    dispose() {
      cancelled = true
      clearTimer()
      window.clearTimeout(eventTimer)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
      void supabase.removeChannel(channel)
    },
  }
}

export function useUnreadNotifications(userId: string | null | undefined, initialCount: number, initialChatCount = 0) {
  const [snapshot, setSnapshot] = useState({ userId, counts: { notifications: initialCount, chats: initialChatCount } })
  const initialCounts = useEffectEvent(() => ({ notifications: initialCount, chats: initialChatCount }))
  useEffect(() => {
    if (!userId) return
    let store = stores.get(userId)
    if (!store) {
      store = createStore(userId, initialCounts())
      stores.set(userId, store)
    }
    const listener: Listener = (counts) => setSnapshot({ userId, counts })
    store.add(listener)
    return () => {
      if (store.remove(listener) === 0) {
        store.dispose()
        stores.delete(userId)
      }
    }
  }, [userId])
  return snapshot.userId === userId ? snapshot.counts : { notifications: initialCount, chats: initialChatCount }
}
