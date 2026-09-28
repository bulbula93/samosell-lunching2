import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { createFlittSandboxCheckout, getFlittConfig, getFlittReadiness } from "@/lib/flitt"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const TEST_BRANCH = "test/flitt-gpay-preview-20260928"
const TEST_AMOUNT = 100

function previewAllowed() {
  return process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === TEST_BRANCH
}

export async function POST() {
  if (!previewAllowed()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const readiness = getFlittReadiness()
  if (!readiness.sandboxEnabled) {
    return NextResponse.json({ error: "flitt_sandbox_disabled" }, { status: 503 })
  }

  const admin = createAdminClient()

  const { data: actor, error: actorError } = await admin
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .limit(1)
    .maybeSingle()

  if (actorError || !actor?.id) {
    console.error("[flitt-gpay-preview] admin actor lookup failed", { code: actorError?.code ?? "not_found" })
    return NextResponse.json({ error: "test_actor_unavailable" }, { status: 503 })
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count } = await admin
    .from("flitt_payment_attempts")
    .select("id", { count: "exact", head: true })
    .eq("purpose", "sandbox_test")
    .eq("user_id", actor.id)
    .gte("created_at", tenMinutesAgo)

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: "test_rate_limited" }, { status: 429 })
  }

  const config = getFlittConfig()
  const orderId = `samosell_gpay_test_${randomUUID().replaceAll("-", "")}`

  const { error: insertError } = await admin.from("flitt_payment_attempts").insert({
    order_id: orderId,
    user_id: actor.id,
    mode: "test",
    purpose: "sandbox_test",
    amount: TEST_AMOUNT,
    currency: "GEL",
    merchant_id: config.merchantId,
    status: "pending",
  })

  if (insertError) {
    console.error("[flitt-gpay-preview] payment attempt create failed", { code: insertError.code })
    return NextResponse.json({ error: "payment_attempt_create_failed" }, { status: 500 })
  }

  try {
    const checkout = await createFlittSandboxCheckout({
      orderId,
      amount: TEST_AMOUNT,
      currency: "GEL",
      description: "SamoSell Google Pay sandbox test",
    })

    const { error: updateError } = await admin
      .from("flitt_payment_attempts")
      .update({ provider_payment_id: checkout.paymentId, updated_at: new Date().toISOString() })
      .eq("order_id", orderId)

    if (updateError) {
      console.error("[flitt-gpay-preview] checkout persistence failed", { code: updateError.code, orderId })
      return NextResponse.json({ error: "payment_attempt_update_failed" }, { status: 500 })
    }

    return NextResponse.json({ orderId, checkoutUrl: checkout.checkoutUrl })
  } catch (error) {
    await admin
      .from("flitt_payment_attempts")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("order_id", orderId)

    console.error("[flitt-gpay-preview] checkout creation failed", {
      orderId,
      message: error instanceof Error ? error.message : "unknown_error",
    })
    return NextResponse.json({ error: "flitt_checkout_failed" }, { status: 502 })
  }
}
