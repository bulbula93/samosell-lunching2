import "server-only"

import { scheduleGrowthMetaDelivery } from "@/lib/growth/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyAdminBoostPurchase } from "@/lib/admin-activity-email"

export type FlittBoostFinalizeResult = {
  order_id: string
  listing_id: string
  status: string
  starts_at: string | null
  ends_at: string | null
  activated: boolean
}

export type FlittBoostReversalResult = {
  order_id: string
  listing_id: string
  status: string
  reconciled: boolean
  changed: boolean
}

export async function finalizeFlittBoostPayment(orderId: string) {
  const safeOrderId = String(orderId ?? "").trim()
  if (!safeOrderId) throw new Error("Flitt boost order id is required")

  const { data, error } = await createAdminClient().rpc("finalize_flitt_boost_payment", {
    p_order_id: safeOrderId,
  })

  if (error) throw error
  const result = data as FlittBoostFinalizeResult

  scheduleGrowthMetaDelivery()
  if (result.activated) {
    await notifyAdminBoostPurchase(safeOrderId, "Flitt")
  }

  return result
}

export async function reverseFlittBoostPayment(orderId: string) {
  const safeOrderId = String(orderId ?? "").trim()
  if (!safeOrderId) throw new Error("Flitt boost order id is required")

  const { data, error } = await createAdminClient().rpc("reverse_flitt_boost_payment", {
    p_order_id: safeOrderId,
  })

  if (error) throw error
  return data as FlittBoostReversalResult
}

/**
 * Close an unpaid VIP checkout ONLY after an independently verified
 * Flitt status API response. This never refunds money or activates VIP.
 *
 * Compare-and-set protects concurrent approved callbacks: paid, activated,
 * previously reviewed and unrelated orders are intentionally untouched.
 */
export function isVerifiedUnpaidFlittTerminal(input: {
  nextStatus: string
  providerStatus: string
  responseStatus: string
}) {
  const state = input.nextStatus.toLowerCase()
  return ["expired", "declined", "failed"].includes(state) &&
    state === input.providerStatus.toLowerCase() &&
    input.responseStatus.toLowerCase() === "success"
}

export async function reconcileUnpaidFlittBoostFailure(
  orderId: string,
  verified: { nextStatus: string; providerStatus: string; responseStatus: string },
) {
  if (!isVerifiedUnpaidFlittTerminal(verified)) {
    throw new Error("Flitt terminal boost status must be independently verified")
  }
  const admin = createAdminClient()
  const { data, error } = await admin.from("listing_boost_orders")
    .update({
      status: "cancelled",
      provider_status: verified.providerStatus.toLowerCase(),
      failure_reason: "Flitt confirmed checkout did not complete. No VIP service was activated.",
      cancelled_at: new Date().toISOString(),
      last_payment_sync_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "pending_payment")
    .eq("payment_provider", "flitt")
    .is("paid_at", null)
    .is("approved_at", null)
    .select("id")
    .maybeSingle()
  if (error) throw error
  return { reconciled: Boolean(data) }
}
