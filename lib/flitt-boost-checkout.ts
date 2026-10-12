import "server-only"

import { createFlittCheckout, getFlittCheckoutConfig } from "@/lib/flitt"
import { createAdminClient } from "@/lib/supabase/admin"

type CheckoutOrder = {
  id: string
  sellerId: string
  amountMinor: number
  currency: string
  paymentReference: string | null
  description: string
}

// Shared by new purchases and seller-confirmed recovery of unpaid manual orders.
// The order already exists; preserving its identity and amount avoids a second
// pending package and keeps the original service-term snapshots intact.
export async function createFlittBoostCheckoutSession(order: CheckoutOrder) {
  const config = getFlittCheckoutConfig()
  const admin = createAdminClient()
  const { error: attemptError } = await admin.from("flitt_payment_attempts").insert({
    order_id: order.id,
    boost_order_id: order.id,
    user_id: order.sellerId,
    mode: config.mode,
    purpose: "boost_order",
    amount: order.amountMinor,
    currency: order.currency,
    merchant_id: config.merchantId,
    status: "pending",
  })

  if (attemptError) {
    await admin.from("listing_boost_orders")
      .update({ status: "under_review", failure_reason: "Flitt payment attempt could not be initialized." })
      .eq("id", order.id)
    throw attemptError
  }

  try {
    const checkout = await createFlittCheckout({
      orderId: order.id,
      amount: order.amountMinor,
      currency: order.currency,
      description: order.description,
    })
    const now = new Date().toISOString()
    const [{ error: attemptUpdateError }, { error: orderUpdateError }] = await Promise.all([
      admin.from("flitt_payment_attempts")
        .update({ provider_payment_id: checkout.paymentId, updated_at: now })
        .eq("order_id", order.id),
      admin.from("listing_boost_orders")
        .update({
          provider_payment_id: checkout.paymentId,
          provider_checkout_url: checkout.checkoutUrl,
          provider_status: "created",
          last_payment_sync_at: now,
        })
        .eq("id", order.id),
    ])
    if (attemptUpdateError) throw attemptUpdateError
    if (orderUpdateError) throw orderUpdateError

    const { error: eventError } = await admin.from("listing_boost_order_events").insert({
      order_id: order.id,
      seller_id: order.sellerId,
      source: "create",
      event_type: "checkout_created",
      provider_status: "created",
      provider_result_code: null,
      message: `Flitt ${config.mode} checkout session created successfully.`,
      payload: { providerPaymentId: checkout.paymentId, paymentReference: order.paymentReference, gateway: "flitt", mode: config.mode },
      event_key: `${order.id}:create:flitt_checkout_created:${checkout.paymentId}`,
    })
    if (eventError) throw eventError
    return checkout.checkoutUrl
  } catch (error) {
    // A timed-out provider call may still have created a payment. Keep the
    // package locked for reconciliation instead of allowing another charge.
    await Promise.all([
      admin.from("flitt_payment_attempts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("order_id", order.id),
      admin.from("listing_boost_orders")
        .update({
          status: "under_review",
          failure_reason: "Flitt checkout creation could not be confirmed. Manual reconciliation required.",
          admin_note: "Verify the Flitt payment attempt before allowing a replacement order.",
        })
        .eq("id", order.id),
    ])
    throw error
  }
}
