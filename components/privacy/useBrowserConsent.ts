"use client"

import { useMemo, useSyncExternalStore } from "react"
import { consentSnapshot, parseConsent, subscribePreferences } from "@/lib/browser-preferences"

export function useBrowserConsent() {
  const snapshot = useSyncExternalStore(subscribePreferences, consentSnapshot, () => "")
  return useMemo(() => parseConsent(snapshot), [snapshot])
}
