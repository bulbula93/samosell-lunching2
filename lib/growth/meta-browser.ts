"use client"
import { getBrowserConsent } from "@/lib/browser-preferences"
import { META_MAPPING, metaCustomData, type GrowthEvent } from "./shared"

type Pixel = ((...args: unknown[]) => void) & { queue: unknown[][]; callMethod?: (...args: unknown[]) => void; push?: Pixel; loaded?: boolean; version?: string }
declare global { interface Window { fbq?: Pixel; _fbq?: Pixel } }
let initialized = false
let granted = false
const seen = new Set<string>()
export function trackMetaBrowser(event: GrowthEvent) {
  if (!getBrowserConsent()?.marketing || !event.marketing_consent) return
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const mapping = META_MAPPING[event.event_name]
  if (!id || !/^\d+$/.test(id) || !mapping) return
  if (seen.has(event.event_id)) return
  try { if (JSON.parse(sessionStorage.getItem("samosell:meta:seen") ?? "[]").includes(event.event_id)) return } catch { /* memory fallback */ }
  if (!initialized) {
    if (!window.fbq) {
      const fbq = ((...args: unknown[]) => { if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue.push(args) }) as Pixel
      fbq.queue = []; fbq.push = fbq; fbq.loaded = true; fbq.version = "2.0"
      window.fbq = fbq; window._fbq = fbq
      const script = document.createElement("script")
      script.async = true; script.src = "https://connect.facebook.net/en_US/fbevents.js"
      document.body.appendChild(script)
    }
    window.fbq("init", id); initialized = true
  }
  if (!granted) { window.fbq?.("consent", "grant"); granted = true }
  window.fbq?.(mapping.custom ? "trackCustom" : "track", mapping.name, metaCustomData(event), { eventID: event.event_id })
  seen.add(event.event_id)
  if (seen.size > 200) seen.delete(seen.values().next().value!)
  try { sessionStorage.setItem("samosell:meta:seen", JSON.stringify([...seen])) } catch { /* ignore unavailable storage */ }
}
export function revokeMetaBrowser() {
  window.fbq?.("consent", "revoke")
  granted = false
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.trim().split("=")[0]
    if (["_fbp", "_fbc"].includes(name)) {
      document.cookie = `${name}=; Path=/; Max-Age=0`
      document.cookie = `${name}=; Path=/; Max-Age=0; Domain=.${location.hostname}`
    }
  }
}
