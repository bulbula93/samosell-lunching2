import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

export type FlittBoostFinalizeResult = {
  order_id: string
  listing_id: string
  status: string
  starts_at: string | null
  ends_at: string | null
  activated: boolean
}

export async function finalizeFlittBoostPayment(orderId: string) {
  const safeOrderId = String(orderId ?? "").trim()
  if (!safeOrderId) throw new Error("Flitt boost order id is required")

  const { data, error } = await createAdminClient().rpc("finalize_flitt_boost_payment", {
    p_order_id: safeOrderId,
  })

  if (error) throw error
  return data as FlittBoostFinalizeResult
}
