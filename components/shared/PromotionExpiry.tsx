"use client"

import { useExpiryClock } from "@/components/shared/useExpiryClock"

// ISR HTML can outlive a paid placement. Remove it at its actual deadline in
// an already open tab too, without polling or another server request.
export default function PromotionExpiry({ until, children, fallback = null }: {
  until?: string | null
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const now = useExpiryClock([until])
  const end = Date.parse(until ?? "")
  const expired = now !== null && (!Number.isFinite(end) || end <= now)
  return expired ? fallback : children
}
