"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"
import type { SellerReminder } from "@/lib/notification-reminders"

const WEEK = 7 * 86_400_000
const listeners = new Set<() => void>()
function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = () => listener()
  window.addEventListener("storage", onStorage)
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage) }
}
function read(key: string) { try { return localStorage.getItem(key) || "{}" } catch { return "{}" } }

export default function SellerReminders({ reminders, userId, now }: { reminders: SellerReminder[]; userId: string; now: number }) {
  const key = `samosell:reminders:${userId}`
  const stored = useSyncExternalStore(subscribe, () => read(key), () => "{}")
  let dismissed: Record<string, number> = {}
  try { const parsed = JSON.parse(stored); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) dismissed = parsed } catch { /* corrupted storage does not hide reminders */ }
  const visible = reminders.filter(item => !(Number(dismissed[item.id]) > now - WEEK)).slice(0, 5)
  if (!visible.length) return null
  function dismiss(id: string, dismissedAt: number) {
    try { localStorage.setItem(key, JSON.stringify({ ...dismissed, [id]: dismissedAt })) } catch { return }
    listeners.forEach(listener => listener())
  }
  return <section className="mb-6 space-y-3" aria-label="სასარგებლო შეხსენებები">
    <div><h2 className="text-lg font-black text-text">შენი ნივთების მოკლე მიმოხილვა</h2>
      <p className="mt-1 text-sm text-text-soft">დაჯგუფებული შეხსენებები, დამატებითი წერილების გარეშე. დამალვის შემდეგ 7 დღე აღარ გამოჩნდება ამ ბრაუზერში.</p></div>
    {visible.map(item => <article key={item.id} className="ui-card flex gap-3 bg-accent-soft p-4">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-sm font-black text-brand">{item.icon}</span>
      <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
        <h3 className="font-black text-text">{item.title}</h3><p className="mt-1 text-sm leading-6 text-text-soft">{item.body}</p>
        <div className="mt-3 flex flex-wrap gap-2"><Link href={item.href} className="ui-btn-secondary min-h-10 text-sm">გადახედვა</Link>
          <button type="button" onClick={() => dismiss(item.id, Date.now())} className="ui-btn-ghost min-h-10 text-sm">7 დღით დამალვა</button></div>
      </div>
    </article>)}
  </section>
}
