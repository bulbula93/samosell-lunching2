"use client"

import { useSearchParams } from "next/navigation"
import { normalizeSearchId } from "@/lib/search-analytics"

export default function SearchAttributionInput({ explicitSearchId = null }: { explicitSearchId?: string | null }) {
  const searchParams = useSearchParams()
  const searchId = normalizeSearchId(explicitSearchId || searchParams.get("search_id"))

  return searchId ? <input type="hidden" name="searchId" value={searchId} /> : null
}
