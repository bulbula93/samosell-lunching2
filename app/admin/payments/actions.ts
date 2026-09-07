"use server"

import { revalidatePath } from "next/cache"
import { redirect, unstable_rethrow } from "next/navigation"
import { requireAdminUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { reconcilePendingTbcOrders } from "@/lib/tbc-sync"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function paymentsRedirect(path: string, flash: string): never {
  const safePath = /^\/admin\/payments(?:[/?]|$)/.test(path) && !path.includes("\\") ? path : "/admin/payments"
  const url = new URL(safePath, "http://local")
  url.searchParams.set("flash", flash)
  redirect(`${url.pathname}${url.search}`)
}

export async function reconcilePendingPaymentsAction(formData: FormData) {
  await requireAdminUser("/dashboard")
  const nextPath = String(formData.get("nextPath") ?? "/admin/payments")
  try {
    const result = await reconcilePendingTbcOrders(5)
    if (!result.enabled) paymentsRedirect(nextPath, "checkout_disabled")
    revalidatePath("/admin/payments")
    paymentsRedirect(nextPath, result.failed > 0 ? "reconcile_partial" : "reconciled")
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
    const { data: refund, error } = await trustedClient
      .from("listing_boost_refund_requests")
      .select("id, order_id, seller_id, status")
      .eq("id", refundId)
      .maybeSingle()
    if (error) throw error
    if (!refund) paymentsRedirect(nextPath, "refund_missing")

    const nextStatus = decision === "review" ? "under_review" : decision === "approve" ? "approved" : "rejected"
    if (refund.status === nextStatus) paymentsRedirect(nextPath, "refund_unchanged")
    const allowed = ["requested", "under_review"]
    if (!allowed.includes(refund.status)) {
      paymentsRedirect(nextPath, "refund_invalid_state")
    }

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

  revalidatePath("/admin/payments")
  revalidatePath("/admin/payments/[orderId]", "page")
  revalidatePath("/dashboard/billing")
  paymentsRedirect(nextPath, decision === "approve" ? "refund_approved" : decision === "reject" ? "refund_rejected" : "refund_reviewing")
}
