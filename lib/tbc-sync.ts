import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { getTbcPaymentDetails, isTbcCheckoutEnabled, isTbcFinalStatus } from "@/lib/tbc"

export type BoostPaymentSyncSource = "callback" | "return" | "manual_sync" | "manual_admin_sync" | "reconciliation" | "system"
type SyncOrder = { id: string; status: string; provider_status?: string | null }
type Claim = { outcome: "claimed" | "busy" | "missing"; id?: string; status?: string; updated_at?: string }
type Applied = { outcome: "applied" | "stale" | "ignored"; order: SyncOrder; activated?: boolean }

export async function syncBoostOrderFromTbcByPayId(payId: string, source: BoostPaymentSyncSource = "system") {
  if (!isTbcCheckoutEnabled()) throw new Error("TBC checkout disabled")
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("claim_tbc_payment_sync", { p_payment_id: payId })
  if (error) throw error
  const claim = data as Claim
  if (claim.outcome === "missing") return { order: null, payment: null, isFinal: false, outcome: "missing" }
  if (claim.outcome === "busy") {
    return { order: { id: claim.id!, status: claim.status! }, payment: null, isFinal: false, outcome: "busy" }
  }
  if (!claim.id || !claim.updated_at) throw new Error("Invalid payment sync claim")

  // Claim before provider I/O; a delayed response cannot overwrite a newer
  // sync/admin change. Unknown IDs never call TBC.
  const payment = await getTbcPaymentDetails(payId)
  if (payment.payId && payment.payId !== payId) throw new Error("TBC payment identity mismatch")
  const { data: appliedData, error: applyError } = await supabase.rpc("apply_verified_tbc_payment", {
    p_order_id: claim.id,
    p_expected_updated_at: claim.updated_at,
    p_payment_id: payId,
    p_provider_status: payment.status ?? null,
    p_result_code: payment.resultCode ?? null,
    p_amount: typeof payment.amount === "number" && Number.isFinite(payment.amount) ? payment.amount : null,
    p_currency: payment.currency ?? null,
    p_source: source,
  })
  if (applyError) throw applyError
  const applied = appliedData as Applied
  return {
    order: applied.order,
    payment: applied.outcome === "applied" ? payment : null,
    isFinal: isTbcFinalStatus(applied.order.provider_status),
    outcome: applied.outcome,
  }
}

export async function syncBoostOrderFromTbcByOrderId(orderId: string, source: BoostPaymentSyncSource = "system") {
  const { data: order, error } = await createAdminClient()
    .from("listing_boost_orders")
    .select("id, provider_payment_id, payment_provider, status")
    .eq("id", orderId)
    .maybeSingle()
  if (error) throw error
  if (!order) return null
  if (order.payment_provider !== "tbc_checkout" || !order.provider_payment_id) {
    return { order: order as SyncOrder, payment: null, isFinal: false, outcome: "missing" }
  }
  return syncBoostOrderFromTbcByPayId(String(order.provider_payment_id), source)
}

export type ReconcilePendingTbcOrdersResult = {
  enabled: boolean; attempted: number; synced: number; failed: number
}

export async function reconcilePendingTbcOrders(limit = 5): Promise<ReconcilePendingTbcOrdersResult> {
  if (!isTbcCheckoutEnabled()) return { enabled: false, attempted: 0, synced: 0, failed: 0 }
  const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(5, Math.floor(limit))) : 5
  const now = Date.now()
  const cutoff = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
  const minAge = new Date(now - 2 * 60 * 1000).toISOString()
  const { data: orders, error } = await createAdminClient()
    .from("listing_boost_orders")
    .select("id")
    .eq("payment_provider", "tbc_checkout")
    .not("provider_payment_id", "is", null)
    .in("status", ["pending_payment", "under_review", "approved"])
    .gte("created_at", cutoff)
    .lte("updated_at", minAge)
    .order("last_payment_sync_attempt_at", { ascending: true, nullsFirst: true })
    .limit(boundedLimit)
  if (error) throw error
  let synced = 0
  let failed = 0
  let attempted = 0
  for (const order of orders ?? []) {
    if (Date.now() - now > 35_000) break
    attempted += 1
    try {
      const result = await syncBoostOrderFromTbcByOrderId(String(order.id), "reconciliation")
      if (result?.outcome === "applied") synced += 1
    } catch {
      failed += 1
      console.error("[tbc] reconciliation failed for order", String(order.id))
    }
  }
  return { enabled: true, attempted, synced, failed }
}
