import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

type ActivateBoostOrderParams = {
  orderId: string
  activationSource: "tbc" | "admin"
  reviewedBy?: string | null
  featuredSlot?: number | null
}

export type BoostActivationResult = {
  order_id: string
  listing_id: string
  status: string
  starts_at: string | null
  ends_at: string | null
  activated: boolean
}

export async function activateBoostOrder(params: ActivateBoostOrderParams) {
  const { data, error } = await createAdminClient().rpc("activate_listing_boost_order", {
    p_order_id: params.orderId,
    p_reviewed_by: params.reviewedBy ?? null,
    p_featured_slot: params.featuredSlot ?? null,
    p_activation_source: params.activationSource,
  })

  if (error) throw error
  return data as BoostActivationResult
}

export async function reconcileListingBoosts(listingId: string) {
  const { error } = await createAdminClient().rpc("reconcile_listing_boosts", {
    p_listing_id: listingId,
  })

  if (error) throw error
}

export async function reconcileExpiredBoostOrders() {
  const { data, error } = await createAdminClient().rpc("reconcile_expired_listing_boosts")
  if (error) throw error
  return Number(data ?? 0)
}
