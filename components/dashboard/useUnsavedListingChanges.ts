"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const LEAVE_MESSAGE = "ბოლო ცვლილებები ჯერ არ არის შენახული. გვერდის დატოვებისას ისინი დაიკარგება. ნამდვილად გსურს გასვლა?"

/** Protect reload/close and ordinary site links without changing browser history. */
export function useUnsavedListingChanges(unsaved: boolean) {
  const router = useRouter()

  useEffect(() => {
    if (!unsaved) return

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }

    function followLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download") || (link.target && link.target !== "_self")) return
      const destination = new URL(link.href, window.location.href)
      // Full document/external navigation is handled by beforeunload. Hash links keep the form mounted.
      if (destination.origin !== window.location.origin || !["http:", "https:"].includes(destination.protocol)) return
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return

      event.preventDefault()
      event.stopPropagation()
      if (window.confirm(LEAVE_MESSAGE)) {
        // Keep the already-validated origin even if a pathname starts with two slashes.
        router.push(destination.href)
      }
    }

    window.addEventListener("beforeunload", beforeUnload)
    // Run before document-level navigation/progress handlers so cancelling cannot start a stuck loader.
    window.addEventListener("click", followLink, true)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      window.removeEventListener("click", followLink, true)
    }
  }, [unsaved, router])
}
