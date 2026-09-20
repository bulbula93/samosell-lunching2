"use server"

import { revalidatePath } from "next/cache"
import { redirect, unstable_rethrow } from "next/navigation"
import { requireAdminUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { isTbcCheckoutEnabled } from "@/lib/tbc"
import { requestProviderRefund } from "@/lib/tbc-refunds"
import {
  reconcilePendingTbcOrders,
  reconcileProcessingTbcRefunds,
  syncBoostOrderFromTbcByOrderId,
} from "@/lib/tbc-sync"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RefundExecutionClaim = {
  outcome: "claimed" | "already_processing" | "terminal" | "missing"
  refund_id?: string
  order_id?: string
  payment_id?: string | null
  amount?: number
  currency?: string
  status?: string
}

function paymentsRedirect(path: string, flash: string): never {
  const safePath = /^\/admin\/payments(?:[/?]|$)/.test(path) && !path.includes("\\") ? path : "/admin/payments"
  const url = new URL(safePath, "http://local")
  url.searchParams.set("flash", flash)
  redirect(`${url.pathname}${url.search}`)
}

function revalidatePaymentViews() {
  revalidatePath("/admin/payments")
  revalidatePath("/admin/payments/[orderId]", "page")
  revalidatePath("/dashboard/billing")
}

export async function reconcilePendingPaymentsAction(formData: FormData) {
  await requireAdminUser("/dashboard")
  const nextPath = String(formData.get("nextPath") ?? "/admin/payments")
  try {
    const [payments, refunds] = await Promise.all([
      reconcilePendingTbcOrders(5),
      reconcileProcessingTbcRefunds(2),
    ])
    if (!payments.enabled && !refunds.enabled) paymentsRedirect(nextPath, "checkout_disabled")
    revalidatePaymentViews()
    paymentsRedirect(nextPath, payments.failed > 0 || refunds.failed > 0 ? "reconcile_partial" : "reconciled")
  } catch (error) {
    unstable_rethrow(error)
    console.error("[tbc] admin reconciliation failed", error instanceof Error ? error.message : "unknown error")
    paymentsRedirect(nextPath, "reconcile_failed")
  }
}

export async function reviewBoostRefundAction(formData: FormData) {
  const refundId = String(formData.get("refundId") ?? "").trim()
  const decision = String(formData.get("decision") ?? "").trim()
  const adminNote = String(formData.get("adminNote") ?? "").trim().slice(0, 2000)
  const nextPath = String(formData.get("nextPath") ?? "/admin/payments")
  if (!UUID_PATTERN.test(refundId) || !["review", "approve", "reject"].includes(decision)) {
    paymentsRedirect(nextPath, "refund_invalid")
  }

  const { user } = await requireAdminUser("/dashboard")
  const trustedClient = createAdminClient()

  try {
    if (decision === "approve") {
      if (!isTbcCheckoutEnabled()) paymentsRedirect(nextPath, "checkout_disabled")

      const { data: claimData, error: claimError } = await trustedClient.rpc("claim_tbc_refund_execution", {
        p_refund_id: refundId,
        p_admin_id: user.id,
      })
      if (claimError) throw claimError

      const claim = claimData as RefundExecutionClaim
      if (claim.outcome === "missing") paymentsRedirect(nextPath, "refund_missing")
      if (claim.outcome === "already_processing") paymentsRedirect(nextPath, "refund_processing")
      if (claim.outcome !== "claimed" || !claim.order_id || !claim.payment_id || !claim.amount || claim.currency !== "GEL") {
        paymentsRedirect(nextPath, "refund_invalid_state")
      }

      if (adminNote) {
        const { error: noteError } = await trustedClient
          .from("listing_boost_refund_requests")
          .update({ admin_note: adminNote })
          .eq("id", refundId)
          .eq("status", "provider_processing")
        if (noteError) throw noteError
      }

      try {
        const provider = await requestProviderRefund({
          paymentId: claim.payment_id,
          amount: Number(claim.amount),
          currency: "GEL",
        })

        if (!provider.ok) {
          const ambiguousProviderFailure = provider.classification === "rate_limited"
            || provider.classification === "provider_unavailable"
          const { error: recordError } = await trustedClient.rpc("record_tbc_refund_execution_result", {
            p_refund_id: refundId,
            p_outcome: ambiguousProviderFailure ? "ambiguous" : "rejected",
            p_http_status: provider.httpStatus,
            p_result_code: provider.resultCode,
            p_error: provider.message,
          })
          if (recordError) throw recordError
          revalidatePaymentViews()
          paymentsRedirect(nextPath, ambiguousProviderFailure ? "refund_provider_uncertain" : "refund_provider_rejected")
        }

        const { error: recordError } = await trustedClient.rpc("record_tbc_refund_execution_result", {
          p_refund_id: refundId,
          p_outcome: "accepted",
          p_http_status: provider.httpStatus,
          p_result_code: null,
          p_error: null,
        })
        if (recordError) throw recordError

        try {
          await syncBoostOrderFromTbcByOrderId(claim.order_id, "manual_admin_sync")
        } catch (syncError) {
          console.error("[tbc] post-refund status verification deferred", syncError instanceof Error ? syncError.message : "unknown error")
        }

        revalidatePaymentViews()
        paymentsRedirect(nextPath, "refund_processing")
      } catch (providerError) {
        unstable_rethrow(providerError)
        const message = providerError instanceof Error ? providerError.message.slice(0, 1000) : "ambiguous transport error"
        const { error: recordError } = await trustedClient.rpc("record_tbc_refund_execution_result", {
          p_refund_id: refundId,
          p_outcome: "ambiguous",
          p_http_status: null,
          p_result_code: null,
          p_error: message,
        })
        if (recordError) throw recordError
        revalidatePaymentViews()
        paymentsRedirect(nextPath, "refund_provider_uncertain")
      }
    }

    const { data: refund, error } = await trustedClient
      .from("listing_boost_refund_requests")
      .select("id, order_id, seller_id, status")
      .eq("id", refundId)
      .maybeSingle()
    if (error) throw error
    if (!refund) paymentsRedirect(nextPath, "refund_missing")

    const nextStatus = decision === "review" ? "under_review" : "rejected"
    if (refund.status === nextStatus) paymentsRedirect(nextPath, "refund_unchanged")
    if (!["requested", "under_review"].includes(refund.status)) paymentsRedirect(nextPath, "refund_invalid_state")

    const nowIso = new Date().toISOString()
    const { data: updated, error: updateError } = await trustedClient
      .from("listing_boost_refund_requests")
      .update({
        status: nextStatus,
        admin_note: adminNote || null,
        reviewed_by: user.id,
        reviewed_at: nowIso,
      })
      .eq("id", refund.id)
      .eq("status", refund.status)
      .select("id")
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) paymentsRedirect(nextPath, "refund_invalid_state")
  } catch (error) {
    unstable_rethrow(error)
    console.error("[tbc] refund review failed", error instanceof Error ? error.message : "unknown error")
    paymentsRedirect(nextPath, "refund_review_failed")
  }

  revalidatePaymentViews()
  paymentsRedirect(nextPath, decision === "reject" ? "refund_rejected" : "refund_reviewing")
}
