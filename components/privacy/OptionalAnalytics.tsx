"use client"

import Script from "next/script"
import { useEffect, useRef } from "react"
import { clearAllListingDrafts } from "@/lib/listing-draft"
import FieldWebVitals from "@/components/shared/FieldWebVitals"
import { useBrowserConsent } from "./useBrowserConsent"

// Public Microsoft Clarity project id (not a secret); loaded only after analytics consent.
const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || "zadx2kl1ea"

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
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_PROJECT_ID}");`}
    </Script>
    <FieldWebVitals />
  </>
}
