import { NextResponse } from "next/server"
import { failFlittAdPayment, finalizeFlittAdPayment, reverseFlittAdPayment } from "@/lib/flitt-ad"
import { finalizeFlittBoostPayment, reverseFlittBoostPayment } from "@/lib/flitt-boost"
import type { FlittAttemptStatus } from "@/lib/flitt"
import { fetchFlittOrderStatus, getFlittReadiness, validateFlittCallback } from "@/lib/flitt"
import { createAdminClient } from "@/lib/supabase/admin"
import { BoundedBodyError, readBoundedRequestBody } from "@/lib/bounded-request-body"

export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 32_768

type CallbackParams = Record<string, unknown>

type AttemptRow = {
  order_id: string
  boost_order_id: string | null
  ad_order_id: string | null
  amount: number
  currency: string
  merchant_id: string
  provider_payment_id: string | null
  provider_verified_at: string | null
  provider_verification_source: string | null
  status: FlittAttemptStatus
  callback_count: number
  mode: string
  purpose: string
}

async function parseCallback(request: Request): Promise<CallbackParams> {
  const text = await readBoundedRequestBody(request, MAX_BODY_BYTES)

  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_json")
    const object = parsed as Record<string, unknown>
    if (object.response && typeof object.response === "object" && !Array.isArray(object.response)) {
      return object.response as CallbackParams
    }
    return object
  }

  const params = new URLSearchParams(text)
  return Object.fromEntries(params.entries())
}

export async function POST(request: Request) {
  let params: CallbackParams
  try {
    params = await parseCallback(request)
  } catch (error) {
    if (error instanceof BoundedBodyError && error.httpStatus === 413) {
      return NextResponse.json({ error: "callback_too_large" }, { status: 413 })
    }
    return NextResponse.json({ error: "invalid_callback_body" }, { status: 400 })
  }

  const orderId = String(params.order_id ?? "").trim()
  if (!orderId || orderId.length > 1024) {
    return NextResponse.json({ error: "invalid_order_id" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("flitt_payment_attempts")
    .select("order_id, boost_order_id, ad_order_id, amount, currency, merchant_id, provider_payment_id, provider_verified_at, provider_verification_source, status, callback_count, mode, purpose")
    .eq("order_id", orderId)
    .maybeSingle()

  if (error) {
    console.error("[flitt] callback lookup failed", { code: error.code, orderId })
    return NextResponse.json({ error: "callback_lookup_failed" }, { status: 500 })
  }

  const attempt = data as AttemptRow | null
  if (!attempt) {
    console.warn("[flitt] ignored callback for unknown order", { orderId })
    return new NextResponse("OK", { status: 200 })
  }

  const readiness = getFlittReadiness()
  if (attempt.mode !== readiness.mode || !["sandbox_test", "boost_order", "ad_order"].includes(attempt.purpose)) {
    console.warn("[flitt] callback refused unsupported attempt", {
      orderId,
      purpose: attempt.purpose,
      attemptMode: attempt.mode,
      configuredMode: readiness.mode,
    })
    return NextResponse.json({ error: "unsupported_attempt" }, { status: 409 })
  }

  let validation
  try {
    validation = validateFlittCallback(params, {
      orderId: attempt.order_id,
      amount: attempt.amount,
      currency: attempt.currency,
      merchantId: attempt.merchant_id,
      providerPaymentId: attempt.provider_payment_id,
      status: attempt.status,
    })
  } catch (error) {
    console.error("[flitt] callback verification configuration failed", {
      orderId,
      message: error instanceof Error ? error.message : "unknown_error",
    })
    return NextResponse.json({ error: "callback_verification_unavailable" }, { status: 503 })
  }

  if (!validation.ok) {
    console.warn("[flitt] rejected callback", { orderId, reason: validation.reason })
    return NextResponse.json({ error: validation.reason }, { status: 400 })
  }

  let verified
  try {
    verified = await fetchFlittOrderStatus({
      orderId: attempt.order_id,
      amount: attempt.amount,
      currency: attempt.currency,
      merchantId: attempt.merchant_id,
      providerPaymentId: attempt.provider_payment_id,
      status: attempt.status,
    })
  } catch (error) {
    console.warn("[flitt] callback status verification unavailable", {
      orderId,
      message: error instanceof Error ? error.message : "unknown_error",
    })
    return NextResponse.json({ error: "authoritative_status_unavailable" }, { status: 503 })
  }

  const independentlyApproved = verified.nextStatus === "approved"
    && verified.providerStatus.toLowerCase() === "approved"
    && verified.responseStatus.toLowerCase() === "success"
  const independentlyReversed = verified.nextStatus === "reversed"
    && verified.providerStatus.toLowerCase() === "reversed"
    && verified.responseStatus.toLowerCase() === "success"
  const independentlyFailed = ["declined", "expired", "failed"].includes(verified.nextStatus)
    && verified.responseStatus.toLowerCase() === "success"
    && !["", "approved", "reversed"].includes(verified.providerStatus.toLowerCase())
  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .from("flitt_payment_attempts")
    .update({
      provider_payment_id: attempt.provider_payment_id ?? verified.paymentId,
      status: verified.nextStatus,
      provider_status: verified.providerStatus || null,
      response_status: verified.responseStatus || null,
      provider_verified_at: independentlyApproved ? now : null,
      provider_verification_source: independentlyApproved ? "status_api" : null,
      callback_count: attempt.callback_count + 1,
      last_callback_at: now,
      updated_at: now,
    })
    .eq("order_id", orderId)

  if (updateError) {
    console.error("[flitt] callback persistence failed", { code: updateError.code, orderId })
    return NextResponse.json({ error: "callback_persistence_failed" }, { status: 500 })
  }

  if (attempt.purpose === "boost_order" && attempt.boost_order_id && independentlyApproved) {
    try {
      // Always retry the idempotent database finalizer. If status persistence
      // succeeded but activation failed on an earlier callback, a duplicate
      // provider callback must be able to finish the paid entitlement.
      await finalizeFlittBoostPayment(attempt.boost_order_id)
    } catch (error) {
      console.error("[flitt] approved boost callback could not be finalized", {
        orderId,
        boostOrderId: attempt.boost_order_id,
        message: error instanceof Error ? error.message : "unknown_error",
      })
      return NextResponse.json({ error: "boost_activation_failed" }, { status: 500 })
    }
  }

  if (attempt.purpose === "boost_order" && attempt.boost_order_id && independentlyReversed) {
    try {
      await reverseFlittBoostPayment(attempt.boost_order_id)
    } catch (error) {
      console.error("[flitt] reversed boost callback could not be reconciled", {
        orderId,
        boostOrderId: attempt.boost_order_id,
        message: error instanceof Error ? error.message : "unknown_error",
      })
      return NextResponse.json({ error: "boost_reversal_failed" }, { status: 500 })
    }
  }

  if (attempt.purpose === "ad_order" && attempt.ad_order_id && independentlyApproved) {
    try {
      await finalizeFlittAdPayment(attempt.ad_order_id)
    } catch (error) {
      console.error("[flitt] approved ad callback could not be finalized", {
        orderId,
        adOrderId: attempt.ad_order_id,
        message: error instanceof Error ? error.message : "unknown_error",
      })
      return NextResponse.json({ error: "ad_payment_finalization_failed" }, { status: 500 })
    }
  }

  if (attempt.purpose === "ad_order" && attempt.ad_order_id && independentlyReversed) {
    try {
      await reverseFlittAdPayment(attempt.ad_order_id)
    } catch (error) {
      console.error("[flitt] reversed ad callback could not be reconciled", {
        orderId,
        adOrderId: attempt.ad_order_id,
        message: error instanceof Error ? error.message : "unknown_error",
      })
      return NextResponse.json({ error: "ad_reversal_failed" }, { status: 500 })
    }
  }

  if (attempt.purpose === "ad_order" && attempt.ad_order_id && independentlyFailed) {
    try {
      await failFlittAdPayment(attempt.ad_order_id)
    } catch (error) {
      console.error("[flitt] failed ad callback could not be reconciled", {
        orderId,
        adOrderId: attempt.ad_order_id,
        message: error instanceof Error ? error.message : "unknown_error",
      })
      return NextResponse.json({ error: "ad_payment_failure_reconciliation_failed" }, { status: 500 })
    }
  }

  return new NextResponse("OK", { status: 200 })
}
