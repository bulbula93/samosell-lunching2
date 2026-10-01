"use client"

import Script from "next/script"
import { useEffect, useRef } from "react"
import { clearAllListingDrafts } from "@/lib/listing-draft"
import FieldWebVitals from "@/components/shared/FieldWebVitals"
import { useBrowserConsent } from "./useBrowserConsent"

export default function OptionalAnalytics() {
  const consent = useBrowserConsent()
  const previouslyEnabled = useRef(false)
  useEffect(() => {
    if (previouslyEnabled.current && !consent?.analytics) {
      const clear = consent?.personalization ? Promise.resolve() : clearAllListingDrafts().catch(() => undefined)
      void clear.then(() => window.location.reload())
    }
    previouslyEnabled.current = consent?.analytics === true
  }, [consent?.analytics, consent?.personalization])
  if (!consent?.analytics) return null
  return <>
    <Script id="vercel-speed-insights-init" strategy="afterInteractive">
      {`window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };`}
    </Script>
    <Script id="vercel-speed-insights" src="/_vercel/speed-insights/script.js" strategy="afterInteractive" />
    <Script id="top-ge-counter" src="https://counter.top.ge/counter.js" strategy="afterInteractive" />
    <FieldWebVitals />
  </>
}
