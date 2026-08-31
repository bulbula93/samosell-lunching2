"use client"

import { useSearchParams } from "next/navigation"
import { normalizeSearchId } from "@/lib/search-analytics"

export default function SearchAttributionInput({ explicitSearchId }: { explicitSearchId?: string | null }) {
  const searchParams = useSearchParams()
  const candidate = explicitSearchId === undefined
    ? searchParams.get("search_id")
    : explicitSearchId
  const searchId = normalizeSearchId(candidate)

  return searchId ? <input type="hidden" name="searchId" value={searchId} /> : null
}
