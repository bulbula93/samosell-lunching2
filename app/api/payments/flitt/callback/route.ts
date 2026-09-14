import { NextResponse } from "next/server"
import { finalizeFlittBoostPayment } from "@/lib/flitt-boost"
import type { FlittAttemptStatus } from "@/lib/flitt"
import { validateFlittCallback } from "@/lib/flitt"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 32_768

type CallbackParams = Record<string, unknown>

type AttemptRow = {
  order_id: string
  boost_order_id: string | null
  amount: number
  currency: string
  merchant_id: string
  provider_payment_id: string | null
  status: FlittAttemptStatus
  callback_count: number
  mode: string
  purpose: string
}

async function parseCallback(request: Request): Promise<CallbackParams> {
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error("callback_too_large")

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
  } catch {
    return NextResponse.json({ error: "invalid_callback_body" }, { status: 400 })
  }

  const orderId = String(params.order_id ?? "").trim()
  if (!orderId || orderId.length > 1024) {
    return NextResponse.json({ error: "invalid_order_id" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("flitt_payment_attempts")
    .select("order_id, boost_order_id, amount, currency, merchant_id, provider_payment_id, status, callback_count, mode, purpose")
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

  if (attempt.mode !== "test" || !["sandbox_test", "boost_order"].includes(attempt.purpose)) {
    console.warn("[flitt] sandbox callback refused unsupported attempt", { orderId, purpose: attempt.purpose, mode: attempt.mode })
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

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .from("flitt_payment_attempts")
    .update({
      provider_payment_id: attempt.provider_payment_id ?? validation.paymentId,
      status: validation.nextStatus,
      provider_status: validation.providerStatus || null,
      response_status: validation.responseStatus || null,
      callback_count: attempt.callback_count + 1,
      last_callback_at: now,
      updated_at: now,
    })
    .eq("order_id", orderId)

  if (updateError) {
    console.error("[flitt] callback persistence failed", { code: updateError.code, orderId })
    return NextResponse.json({ error: "callback_persistence_failed" }, { status: 500 })
  }

  if (attempt.purpose === "boost_order" && attempt.boost_order_id && validation.nextStatus === "approved") {
    try {
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

  return new NextResponse("OK", { status: 200 })
}
