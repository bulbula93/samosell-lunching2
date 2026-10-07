"use client"
import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useBrowserConsent } from "@/components/privacy/useBrowserConsent"
import { clearGrowthStorage, growthContext, trackGrowth } from "@/lib/growth/client"

export default function GrowthInstrumentation() {
  const pathname = usePathname()
  const search = useSearchParams()
  const consent = useBrowserConsent()
  const last = useRef("")
  const previous = useRef(false)
  const anonymous = useRef<string | null>(null)
  useEffect(() => {
    if (!consent?.analytics) { clearGrowthStorage(); last.current = ""; return }
    // Auth codes/queries never enter event payloads. Query changes still represent navigation.
    const key = `${pathname}?${search.toString()}`
    if (last.current === key) return
    last.current = key
    anonymous.current = growthContext()?.anonymous_id ?? null
    const id = crypto.randomUUID()
    const timer = setTimeout(() => { void trackGrowth("page_view", id) }, 0)
    return () => { clearTimeout(timer); last.current = "" }
  }, [pathname, search, consent?.analytics])
  useEffect(() => {
    if (!consent) return
    if (previous.current && (!consent.analytics || !consent.marketing)) void fetch("/api/growth/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_name: "consent_revoked", anonymous_id: anonymous.current }), keepalive: true }).catch(() => undefined)
    previous.current = consent.analytics || consent.marketing === true
    if (!consent.marketing) void import("@/lib/growth/meta-browser").then(module => module.revokeMetaBrowser())
    if (consent.analytics) void trackGrowth("identify")
  }, [consent])
  return null
}
