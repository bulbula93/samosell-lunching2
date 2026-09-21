import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

export type FlittAdFinalizeResult = {
  order_id: string
  ad_id: string
  status: string
  paid_at: string | null
  changed: boolean
}

export type FlittAdReversalResult = {
  order_id: string
  ad_id: string
  status: string
  changed: boolean
}

export async function finalizeFlittAdPayment(orderId: string) {
  const safeOrderId = String(orderId ?? "").trim()
  if (!safeOrderId) throw new Error("Flitt ad order id is required")

  const { data, error } = await createAdminClient().rpc("finalize_flitt_ad_payment", {
    p_order_id: safeOrderId,
  })

  if (error) throw error
  return data as FlittAdFinalizeResult
}

export async function reverseFlittAdPayment(orderId: string) {
  const safeOrderId = String(orderId ?? "").trim()
  if (!safeOrderId) throw new Error("Flitt ad order id is required")

  const { data, error } = await createAdminClient().rpc("reverse_flitt_ad_payment", {
    p_order_id: safeOrderId,
  })

  if (error) throw error
  return data as FlittAdReversalResult
}
