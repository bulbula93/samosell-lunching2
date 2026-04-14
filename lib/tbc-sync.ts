import { buildBoostDurationEndsAt } from "@/lib/boosts"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTbcPaymentDetails, isTbcFinalStatus, mapTbcStatusToBoostOrderStatus, type TbcPaymentDetails } from "@/lib/tbc"

type BoostPaymentSyncSource = "callback" | "return" | "manual_sync" | "system"

type TbcOrderSyncRow = {
  id: string
  listing_id: string
  seller_id: string
  product_id: string
  status: string
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
  listings?: {
    id: string
    is_vip?: boolean | null
    vip_until?: string | null
    promoted_until?: string | null
    featured_until?: string | null
    featured_slot?: number | null
  } | null
  listing_boost_products?: {
    id: string
    placement?: string | null
    duration_days?: number | null
  } | null
}

async function getOrderForSyncByPayId(payId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("listing_boost_orders")
    .select(`
      id,
      listing_id,
      seller_id,
      product_id,
      status,
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
      last_payment_sync_at,
      listings!inner(id, is_vip, vip_until, promoted_until, featured_until, featured_slot),
      listing_boost_products!inner(id, placement, duration_days)
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
    eventType: "checkout_created" | "callback_received" | "status_synced" | "payment_succeeded" | "payment_pending" | "payment_failed" | "boost_activated" | "boost_cancelled" | "note"
    payment?: TbcPaymentDetails | null
    message?: string | null
    payload?: unknown
  }
) {
  const supabase = createAdminClient()

  try {
    await supabase.from("listing_boost_order_events").insert({
      order_id: order.id,
      seller_id: order.seller_id,
      source: params.source,
      event_type: params.eventType,
      provider_status: params.payment?.status ?? null,
      provider_result_code: params.payment?.resultCode ?? null,
      message: params.message ?? null,
      payload: params.payload ?? null,
    })
  } catch {
    // Optional audit trail table may not exist yet in environments where migration 18 is not applied.
  }
}

function buildFailureReason(payment: TbcPaymentDetails) {
  const candidates = [payment.userMessage, payment.developerMessage, payment.status]
  for (const candidate of candidates) {
    const safe = String(candidate ?? "").trim()
    if (safe) return safe
  }
  return null
}

async function activateOrderAfterSuccessfulTbc(
  order: TbcOrderSyncRow,
  payment: TbcPaymentDetails,
  source: BoostPaymentSyncSource
) {
  const supabase = createAdminClient()
  const listing = order.listings
  const product = order.listing_boost_products
  if (!listing || !product) return order

  const providerStatus = payment.status ?? null
  const providerResultCode = payment.resultCode ?? null
  const nowIso = new Date().toISOString()
  const resolvedPaidAt = order.paid_at ?? order.approved_at ?? nowIso

  if (order.status === "active" && order.ends_at) {
    await supabase
      .from("listing_boost_orders")
      .update({
        provider_status: providerStatus,
        provider_result_code: providerResultCode,
        approved_at: order.approved_at ?? resolvedPaidAt,
        paid_at: resolvedPaidAt,
        last_payment_sync_at: nowIso,
        cancelled_at: null,
        failure_reason: null,
      })
      .eq("id", order.id)

    await recordBoostOrderEvent(order, {
      source,
      eventType: "payment_succeeded",
      payment,
      message: "TBC payment was confirmed again for an already-active boost order.",
      payload: { orderStatus: order.status },
    })

    return getOrderForSyncByPayId(String(order.provider_payment_id ?? ""))
  }

  const { data: claimedOrder, error: claimError } = await supabase
    .from("listing_boost_orders")
    .update({
      status: "approved",
      provider_status: providerStatus,
      provider_result_code: providerResultCode,
      approved_at: order.approved_at ?? resolvedPaidAt,
      starts_at: order.starts_at ?? nowIso,
      paid_at: resolvedPaidAt,
      last_payment_sync_at: nowIso,
      cancelled_at: null,
      failure_reason: null,
      admin_note: "TBC Checkout payment confirmed and auto-activation started.",
    })
    .eq("id", order.id)
    .in("status", ["pending_payment", "under_review", "approved"])
    .is("ends_at", null)
    .select("id")
    .maybeSingle()

  if (claimError) throw claimError

  await recordBoostOrderEvent(order, {
    source,
    eventType: "payment_succeeded",
    payment,
    message: "TBC payment confirmed. Boost activation flow started.",
  })

  if (!claimedOrder) {
    return getOrderForSyncByPayId(String(order.provider_payment_id ?? ""))
  }

  const durationDays = Number(product.duration_days ?? 0)
  if (!durationDays) {
    await supabase
      .from("listing_boost_orders")
      .update({
        status: "approved",
        provider_status: providerStatus,
        provider_result_code: providerResultCode,
        paid_at: resolvedPaidAt,
        last_payment_sync_at: nowIso,
        cancelled_at: null,
        failure_reason: "Boost product duration is invalid. Manual review required.",
        admin_note: "TBC payment confirmed, but boost product duration is invalid. Manual review required.",
      })
      .eq("id", order.id)

    await recordBoostOrderEvent(order, {
      source,
      eventType: "note",
      payment,
      message: "Payment confirmed, but boost duration is invalid. Manual intervention required.",
    })

    return getOrderForSyncByPayId(String(order.provider_payment_id ?? ""))
  }

  const placement = String(product.placement ?? "")
  const nextListingUpdate: Record<string, unknown> = {}
  const nextEndsAtByPlacement = {
    vip: buildBoostDurationEndsAt(listing.vip_until, durationDays),
    promoted: buildBoostDurationEndsAt(listing.promoted_until, durationDays),
    featured: buildBoostDurationEndsAt(listing.featured_until, durationDays),
  }

  if (placement === "vip" || placement === "combo") {
    nextListingUpdate.is_vip = true
    nextListingUpdate.vip_until = nextEndsAtByPlacement.vip
  }

  if (placement === "promoted" || placement === "combo") {
    nextListingUpdate.promoted_until = nextEndsAtByPlacement.promoted
  }

  if (placement === "featured_home" || placement === "combo") {
    nextListingUpdate.featured_until = nextEndsAtByPlacement.featured
    nextListingUpdate.featured_slot = listing.featured_slot ?? 1
  }

  const resolvedEndsAt =
    placement === "vip"
      ? nextEndsAtByPlacement.vip
      : placement === "promoted"
        ? nextEndsAtByPlacement.promoted
        : placement === "featured_home"
          ? nextEndsAtByPlacement.featured
          : [nextEndsAtByPlacement.vip, nextEndsAtByPlacement.promoted, nextEndsAtByPlacement.featured]
              .filter(Boolean)
              .sort()
              .at(-1) ?? nowIso

  const { error: listingError } = await supabase
    .from("listings")
    .update(nextListingUpdate)
    .eq("id", listing.id)

  if (listingError) throw listingError

  const { error: activateError } = await supabase
    .from("listing_boost_orders")
    .update({
      status: "active",
      provider_status: providerStatus,
      provider_result_code: providerResultCode,
      approved_at: order.approved_at ?? resolvedPaidAt,
      starts_at: order.starts_at ?? nowIso,
      ends_at: resolvedEndsAt,
      paid_at: resolvedPaidAt,
      last_payment_sync_at: nowIso,
      cancelled_at: null,
      failure_reason: null,
      admin_note: "TBC Checkout payment confirmed and boost auto-activated.",
    })
    .eq("id", order.id)

  if (activateError) throw activateError

  await recordBoostOrderEvent(order, {
    source,
    eventType: "boost_activated",
    payment,
    message: "Boost was auto-activated after successful TBC payment.",
    payload: { placement, endsAt: resolvedEndsAt },
  })

  return getOrderForSyncByPayId(String(order.provider_payment_id ?? ""))
}

export async function syncBoostOrderFromTbcByPayId(payId: string, source: BoostPaymentSyncSource = "system") {
  const payment = await getTbcPaymentDetails(payId)
  const providerStatus = String(payment.status ?? "") || null
  const nextStatus = mapTbcStatusToBoostOrderStatus(providerStatus)
  const isApproved = providerStatus === "Succeeded" || providerStatus === "WaitingConfirm"
  const providerResultCode = payment.resultCode ?? null
  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()

  const order = await getOrderForSyncByPayId(payId)
  if (!order) {
    return {
      order: null,
      payment,
      isFinal: isTbcFinalStatus(providerStatus),
    }
  }

  if (source === "callback") {
    await recordBoostOrderEvent(order, {
      source,
      eventType: "callback_received",
      payment,
      message: "Callback received from TBC and payment status sync started.",
    })
  }

  let syncedOrder: TbcOrderSyncRow | null = order

  if (isApproved) {
    syncedOrder = await activateOrderAfterSuccessfulTbc(order, payment, source)
  } else {
    const failureReason = nextStatus === "cancelled" ? buildFailureReason(payment) : null
    const updatePayload: Record<string, unknown> = {
      provider_status: providerStatus,
      provider_result_code: providerResultCode,
      status: nextStatus,
      last_payment_sync_at: nowIso,
      failure_reason: failureReason,
    }

    if (nextStatus === "cancelled") {
      updatePayload.cancelled_at = order.cancelled_at ?? nowIso
      updatePayload.admin_note = "TBC Checkout payment did not complete."
    }

    const { error } = await supabase
      .from("listing_boost_orders")
      .update(updatePayload)
      .eq("id", order.id)

    if (error) throw error

    await recordBoostOrderEvent(order, {
      source,
      eventType: nextStatus === "cancelled" ? "payment_failed" : "payment_pending",
      payment,
      message:
        nextStatus === "cancelled"
          ? failureReason ?? "TBC payment ended with a non-success final status."
          : "TBC payment is still pending or being processed.",
    })

    syncedOrder = await getOrderForSyncByPayId(payId)
  }

  if (syncedOrder) {
    await recordBoostOrderEvent(syncedOrder, {
      source,
      eventType: "status_synced",
      payment,
      message: `Order synced from TBC. Local status: ${syncedOrder.status}.`,
      payload: { localStatus: syncedOrder.status, isFinal: isTbcFinalStatus(providerStatus), syncedAt: nowIso },
    })
  }

  return {
    order: syncedOrder,
    payment,
    isFinal: isTbcFinalStatus(providerStatus),
  }
}

export async function syncBoostOrderFromTbcByOrderId(orderId: string, source: BoostPaymentSyncSource = "system") {
  const supabase = createAdminClient()
  const { data: order, error } = await supabase
    .from("listing_boost_orders")
    .select("id, provider_payment_id, payment_provider, status, starts_at, ends_at")
    .eq("id", orderId)
    .maybeSingle()

  if (error) throw error
  if (!order) return null
  if (order.payment_provider !== "tbc_checkout" || !order.provider_payment_id) return { order, payment: null, isFinal: false }

  return syncBoostOrderFromTbcByPayId(String(order.provider_payment_id), source)
}
