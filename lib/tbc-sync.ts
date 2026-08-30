import { activateBoostOrder, reconcileListingBoosts } from "@/lib/boost-reconciliation"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTbcPaymentDetails, isTbcFinalStatus, mapTbcStatusToBoostOrderStatus, type TbcPaymentDetails } from "@/lib/tbc"

type BoostPaymentSyncSource = "callback" | "return" | "manual_sync" | "system"

type TbcOrderSyncRow = {
  id: string
  listing_id: string
  seller_id: string
  product_id: string
  status: string
  amount: number
  currency: string
  starts_at?: string | null
  ends_at?: string | null
  approved_at?: string | null
  payment_provider?: string | null
  provider_payment_id?: string | null
  provider_status?: string | null
  provider_result_code?: string | null
  paid_at?: string | null
  cancelled_at?: string | null
  failure_reason?: string | null
  last_payment_sync_at?: string | null
}

type BoostEventType =
  | "checkout_created"
  | "callback_received"
  | "status_synced"
  | "payment_succeeded"
  | "payment_pending"
  | "payment_failed"
  | "boost_cancelled"
  | "note"

async function getOrderForSyncByPayId(payId: string) {
  const { data, error } = await createAdminClient()
    .from("listing_boost_orders")
    .select(`
      id,
      listing_id,
      seller_id,
      product_id,
      status,
      amount,
      currency,
      starts_at,
      ends_at,
      approved_at,
      payment_provider,
      provider_payment_id,
      provider_status,
      provider_result_code,
      paid_at,
      cancelled_at,
      failure_reason,
      last_payment_sync_at
    `)
    .eq("provider_payment_id", payId)
    .eq("payment_provider", "tbc_checkout")
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as TbcOrderSyncRow | null
}

async function recordBoostOrderEvent(
  order: Pick<TbcOrderSyncRow, "id" | "seller_id">,
  params: {
    source: BoostPaymentSyncSource | "create" | "admin"
    eventType: BoostEventType
    payment?: TbcPaymentDetails | null
    message?: string | null
    payload?: unknown
  }
) {
  const { error } = await createAdminClient().from("listing_boost_order_events").insert({
    order_id: order.id,
    seller_id: order.seller_id,
    source: params.source,
    event_type: params.eventType,
    provider_status: params.payment?.status ?? null,
    provider_result_code: params.payment?.resultCode ?? null,
    message: params.message ?? null,
    payload: params.payload ?? null,
  })

  if (error) throw error
}

function buildFailureReason(payment: TbcPaymentDetails) {
  for (const candidate of [payment.userMessage, payment.developerMessage, payment.status]) {
    const safe = String(candidate ?? "").trim()
    if (safe) return safe
  }
  return null
}

function paymentMatchesOrder(order: TbcOrderSyncRow, payment: TbcPaymentDetails) {
  const expectedAmount = Math.round(Number(order.amount) * 100)
  const confirmedAmount = Math.round(Number(payment.amount) * 100)
  const expectedCurrency = String(order.currency || "").trim().toUpperCase()
  const confirmedCurrency = String(payment.currency || "").trim().toUpperCase()

  return Number.isFinite(confirmedAmount)
    && confirmedAmount === expectedAmount
    && Boolean(confirmedCurrency)
    && confirmedCurrency === expectedCurrency
}

async function activateSucceededOrder(
  order: TbcOrderSyncRow,
  payment: TbcPaymentDetails,
  source: BoostPaymentSyncSource,
) {
  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()
  const providerStatus = String(payment.status ?? "") || null
  const providerResultCode = payment.resultCode ?? null

  if (!paymentMatchesOrder(order, payment)) {
    const failureReason = "TBC payment amount or currency does not match the boost order. Manual review required."
    const { error } = await supabase
      .from("listing_boost_orders")
      .update({
        status: order.status === "active" ? "active" : "under_review",
        provider_status: providerStatus,
        provider_result_code: providerResultCode,
        last_payment_sync_at: nowIso,
        failure_reason: failureReason,
        admin_note: failureReason,
      })
      .eq("id", order.id)

    if (error) throw error

    await recordBoostOrderEvent(order, {
      source,
      eventType: "note",
      payment,
      message: failureReason,
      payload: {
        expectedAmount: Number(order.amount),
        expectedCurrency: order.currency,
        confirmedAmount: payment.amount ?? null,
        confirmedCurrency: payment.currency ?? null,
      },
    })
    return getOrderForSyncByPayId(String(order.provider_payment_id ?? ""))
  }

  if (!["pending_payment", "under_review", "approved", "active"].includes(order.status)) {
    await recordBoostOrderEvent(order, {
      source,
      eventType: "note",
      payment,
      message: `Succeeded payment was not activated because local order status is ${order.status}.`,
    })
    return order
  }

  const paidAt = order.paid_at ?? order.approved_at ?? nowIso
  const updatePayload: Record<string, unknown> = {
    provider_status: providerStatus,
    provider_result_code: providerResultCode,
    approved_at: order.approved_at ?? paidAt,
    paid_at: paidAt,
    last_payment_sync_at: nowIso,
    cancelled_at: null,
    failure_reason: null,
    admin_note: "TBC Checkout payment independently verified as Succeeded.",
  }
  if (order.status !== "active") updatePayload.status = "approved"

  const { error } = await supabase
    .from("listing_boost_orders")
    .update(updatePayload)
    .eq("id", order.id)

  if (error) throw error

  await recordBoostOrderEvent(order, {
    source,
    eventType: "payment_succeeded",
    payment,
    message: "TBC payment status, amount, and currency were independently verified.",
  })

  await activateBoostOrder({ orderId: order.id, activationSource: "tbc" })
  return getOrderForSyncByPayId(String(order.provider_payment_id ?? ""))
}

async function syncNonSucceededOrder(
  order: TbcOrderSyncRow,
  payment: TbcPaymentDetails,
  source: BoostPaymentSyncSource,
) {
  const providerStatus = String(payment.status ?? "") || null
  const nextStatus = mapTbcStatusToBoostOrderStatus(providerStatus)
  const isCancelled = nextStatus === "cancelled"
  const nowIso = new Date().toISOString()
  const failureReason = isCancelled
    ? buildFailureReason(payment)
    : providerStatus === "WaitingConfirm"
      ? "WaitingConfirm is valid only for preauthorization; this checkout uses preAuth=false and requires manual review."
      : null

  const updatePayload: Record<string, unknown> = {
    provider_status: providerStatus,
    provider_result_code: payment.resultCode ?? null,
    status: isCancelled ? "cancelled" : nextStatus,
    last_payment_sync_at: nowIso,
    failure_reason: failureReason,
  }

  if (isCancelled) {
    updatePayload.cancelled_at = order.cancelled_at ?? nowIso
    updatePayload.admin_note = "TBC Checkout payment did not remain successful."
  }

  const { error } = await createAdminClient()
    .from("listing_boost_orders")
    .update(updatePayload)
    .eq("id", order.id)

  if (error) throw error

  if (isCancelled && order.status === "active") {
    await reconcileListingBoosts(order.listing_id)
    await recordBoostOrderEvent(order, {
      source,
      eventType: "boost_cancelled",
      payment,
      message: "Active boost removed after TBC reported a failed, expired, returned, or partially returned payment.",
    })
  }

  await recordBoostOrderEvent(order, {
    source,
    eventType: isCancelled ? "payment_failed" : "payment_pending",
    payment,
    message: failureReason ?? "TBC payment is still pending or being processed.",
  })

  return getOrderForSyncByPayId(String(order.provider_payment_id ?? ""))
}

export async function syncBoostOrderFromTbcByPayId(payId: string, source: BoostPaymentSyncSource = "system") {
  const payment = await getTbcPaymentDetails(payId)
  const providerStatus = String(payment.status ?? "") || null
  const order = await getOrderForSyncByPayId(payId)

  if (!order) return { order: null, payment, isFinal: isTbcFinalStatus(providerStatus) }

  if (source === "callback") {
    await recordBoostOrderEvent(order, {
      source,
      eventType: "callback_received",
      payment,
      message: "TBC callback received; server-side payment verification started.",
    })
  }

  const syncedOrder = providerStatus === "Succeeded"
    ? await activateSucceededOrder(order, payment, source)
    : await syncNonSucceededOrder(order, payment, source)

  if (syncedOrder) {
    await recordBoostOrderEvent(syncedOrder, {
      source,
      eventType: "status_synced",
      payment,
      message: `Order synced from TBC. Local status: ${syncedOrder.status}.`,
      payload: { localStatus: syncedOrder.status, isFinal: isTbcFinalStatus(providerStatus) },
    })
  }

  return { order: syncedOrder, payment, isFinal: isTbcFinalStatus(providerStatus) }
}

export async function syncBoostOrderFromTbcByOrderId(orderId: string, source: BoostPaymentSyncSource = "system") {
  const { data: order, error } = await createAdminClient()
    .from("listing_boost_orders")
    .select("id, provider_payment_id, payment_provider, status, starts_at, ends_at")
    .eq("id", orderId)
    .maybeSingle()

  if (error) throw error
  if (!order) return null
  if (order.payment_provider !== "tbc_checkout" || !order.provider_payment_id) {
    return { order, payment: null, isFinal: false }
  }

  return syncBoostOrderFromTbcByPayId(String(order.provider_payment_id), source)
}
