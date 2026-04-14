"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN

function postClientError(payload: Record<string, unknown>) {
  try {
    navigator.sendBeacon?.("/api/monitoring/client-error", JSON.stringify(payload))
  } catch {
    // ignore
  }
}

export default function ClientInstrumentation() {
  const pathname = usePathname()

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : ""
    const path = `${pathname}${search}`

    if (typeof window !== "undefined") {
      const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
      if (gaId && typeof gtag === "function") {
        gtag("config", gaId, { page_path: path })
      }

      const plausible = (window as Window & { plausible?: (event: string, options?: Record<string, unknown>) => void }).plausible
      if (plausibleDomain && typeof plausible === "function") {
        plausible("pageview", { props: { path } })
      }
    }
  }, [pathname])

  useEffect(() => {
    function onError(event: ErrorEvent) {
      postClientError({
        type: "error",
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        path: window.location.pathname,
      })
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      postClientError({
        type: "unhandledrejection",
        message: event.reason instanceof Error ? event.reason.message : String(event.reason || "promise_rejection"),
        path: window.location.pathname,
      })
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onUnhandledRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
    }
  }, [])

  return (
    <>
      {gaId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} window.gtag = gtag; gtag('js', new Date()); gtag('config', '${gaId}', { send_page_view: false });`}
          </Script>
        </>
      ) : null}
      {plausibleDomain ? <Script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" strategy="afterInteractive" /> : null}
    </>
  )
}
