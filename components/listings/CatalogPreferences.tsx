"use client"

import Link from "next/link"
import { useEffect, useSyncExternalStore } from "react"
import { useBrowserConsent } from "@/components/privacy/useBrowserConsent"
import { subscribePreferences, removePreference } from "@/lib/browser-preferences"
import { CATALOG_PREFERENCE_KEY, catalogPreferencePath, readCatalogFilters, rememberCatalogFilters } from "@/lib/catalog-preferences"

export default function CatalogPreferences({ values }: { values: Record<string, string> }) {
  const consent = useBrowserConsent()
  const savedPath = useSyncExternalStore(subscribePreferences, readCatalogFilters, () => "")
  const path = catalogPreferencePath(values)
  useEffect(() => {
    if (consent?.personalization && path) rememberCatalogFilters(values)
  }, [consent?.personalization, path, values])
  if (!consent?.personalization || path || values.q || !savedPath) return null
  return <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-brand-soft px-4 py-3 text-sm">
    <span>შენი ბოლო ფილტრები დამახსოვრებულია.</span>
    <Link href={savedPath} className="font-bold text-brand underline">ბოლო ფილტრების აღდგენა</Link>
    <button type="button" onClick={() => removePreference(CATALOG_PREFERENCE_KEY)} className="ml-auto text-xs text-text-soft underline">დავიწყება</button>
  </div>
}
