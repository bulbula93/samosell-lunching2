import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { createFlittCheckout, getFlittCheckoutConfig, getFlittReadiness } from "@/lib/flitt"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const MIN_SANDBOX_AMOUNT = 100
const MAX_SANDBOX_AMOUNT = 10_000
const LIVE_VALIDATION_AMOUNT = 10

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
  if (!profile?.is_admin) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  return { user }
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const readiness = getFlittReadiness()
  const liveValidation = readiness.mode === "live"

  if (liveValidation) {
    if (!readiness.liveEnabled || !readiness.productionDeployment) {
      return NextResponse.json({ error: "flitt_live_validation_disabled" }, { status: 503 })
    }
  } else if (!readiness.sandboxEnabled) {
    return NextResponse.json({ error: "flitt_sandbox_disabled" }, { status: 503 })
  }

  let amount = liveValidation ? LIVE_VALIDATION_AMOUNT : MIN_SANDBOX_AMOUNT

  if (!liveValidation) {
    try {
      const body = await request.json() as { amount?: unknown }
      if (body.amount !== undefined) amount = Number(body.amount)
    } catch {
      // Empty body is valid; use the fixed sandbox default.
    }

    if (!Number.isInteger(amount) || amount < MIN_SANDBOX_AMOUNT || amount > MAX_SANDBOX_AMOUNT) {
      return NextResponse.json({ error: "invalid_test_amount" }, { status: 400 })
    }
  }

  const config = getFlittCheckoutConfig()
  const admin = createAdminClient()
  const prefix = liveValidation ? "samosell_livecheck" : "samosell_test"
  const orderId = `${prefix}_${randomUUID().replaceAll("-", "")}`

  const { error: insertError } = await admin.from("flitt_payment_attempts").insert({
    order_id: orderId,
    user_id: auth.user.id,
    mode: config.mode,
    purpose: "sandbox_test",
    amount,
    currency: "GEL",
    merchant_id: config.merchantId,
    status: "pending",
  })

  if (insertError) {
    console.error("[flitt] failed to create validation payment attempt", { code: insertError.code, mode: config.mode })
    return NextResponse.json({ error: "payment_attempt_create_failed" }, { status: 500 })
  }

  try {
    const checkout = await createFlittCheckout({
      orderId,
      amount,
      currency: "GEL",
      description: liveValidation ? "SamoSell live verification 0.10 GEL" : "SamoSell sandbox payment",
    })

    const { error: updateError } = await admin
      .from("flitt_payment_attempts")
      .update({ provider_payment_id: checkout.paymentId, updated_at: new Date().toISOString() })
      .eq("order_id", orderId)

    if (updateError) {
      console.error("[flitt] checkout created but payment id persistence failed", { code: updateError.code, orderId })
      return NextResponse.json({ error: "payment_attempt_update_failed" }, { status: 500 })
    }

    return NextResponse.json({
      orderId,
      checkoutUrl: checkout.checkoutUrl,
      mode: config.mode,
      amount,
      currency: "GEL",
    })
  } catch (error) {
    await admin
      .from("flitt_payment_attempts")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("order_id", orderId)

    console.error("[flitt] validation checkout creation failed", {
      orderId,
      mode: config.mode,
      message: error instanceof Error ? error.message : "unknown_error",
    })
    return NextResponse.json({ error: "flitt_checkout_failed" }, { status: 502 })
  }
}
