"use server"

import { revalidatePath } from "next/cache"
import { redirect, unstable_rethrow } from "next/navigation"
import { requireAuthenticatedUser } from "@/lib/auth"
import { isRefundRequestEligible } from "@/lib/payment-status"
import { createAdminClient } from "@/lib/supabase/admin"
import { enforceRateLimit } from "@/lib/rate-limit"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function billingRedirect(flash: string): never {
  redirect(`/dashboard/billing?flash=${encodeURIComponent(flash)}`)
}

export async function requestBoostRefundAction(formData: FormData) {
  const orderId = String(formData.get("orderId") ?? "").trim()
  const reason = String(formData.get("reason") ?? "").trim()
  if (!UUID_PATTERN.test(orderId)) billingRedirect("refund_invalid_order")
  if (reason.length < 10 || reason.length > 1000) billingRedirect("refund_invalid_reason")

  const { supabase, user } = await requireAuthenticatedUser("/dashboard/billing")
  try {
    await enforceRateLimit(supabase, "payment_refund")
    const { data: order, error } = await supabase
      .from("listing_boost_orders")
      .select("id, seller_id, amount, currency, payment_provider, provider_status, paid_at")
      .eq("id", orderId)
      .eq("seller_id", user.id)
      .maybeSingle()
    if (error) throw error
    if (!order || !isRefundRequestEligible(order)) billingRedirect("refund_not_eligible")

    const trustedClient = createAdminClient()
    const { error: refundError } = await trustedClient
      .from("listing_boost_refund_requests")
      .insert({
        order_id: order.id,
        seller_id: user.id,
        status: "requested",
        amount: Number(order.amount),
        currency: order.currency,
        reason,
      })
      .select("id")
      .single()
    if (refundError) {
      if (refundError.code === "23505") billingRedirect("refund_already_open")
      throw refundError
    }

  } catch (error) {
    unstable_rethrow(error)
    console.error("[tbc] refund request failed", error instanceof Error ? error.message : "unknown error")
    billingRedirect("refund_request_failed")
  }

  revalidatePath("/dashboard/billing")
  revalidatePath("/admin/payments")
  billingRedirect("refund_requested")
}
