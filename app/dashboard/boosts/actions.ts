"use server"

import { recordGrowthCheckout } from "@/lib/growth/server"
import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { redirect, unstable_rethrow } from "next/navigation"
import { buildSuggestedBoostReference, canResumeManualBoostCheckout } from "@/lib/boosts"
import { getBoostPaymentConfig } from "@/lib/boost-payment-config"
import { createFlittBoostCheckoutSession } from "@/lib/flitt-boost-checkout"
import type { BoostOrder } from "@/types/boost"
import { activateBoostOrder, reconcileExpiredBoostOrders } from "@/lib/boost-reconciliation"
import { getFlittCheckoutConfig } from "@/lib/flitt"
import { humanizeSupabaseError } from "@/lib/listings"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createTbcPayment, isTbcCheckoutEnabled } from "@/lib/tbc"
import { syncBoostOrderFromTbcByOrderId } from "@/lib/tbc-sync"
import { enforceRateLimit } from "@/lib/rate-limit"

type ProductRow = {
  id: string
  name: string
  placement: string
  duration_days: number
  price: number
  currency: string
  is_active: boolean
}

type ListingRow = {
  id: string
  seller_id: string
  slug: string
  title: string
  is_vip?: boolean | null
  vip_until?: string | null
  promoted_until?: string | null
  featured_until?: string | null
  featured_slot?: number | null
  home_banner_until?: string | null
  home_banner_slot?: number | null
}

type AdminOrderRow = {
  id: string
  listing_id: string
  seller_id: string
  product_id: string
  status: string
  amount: number
  currency: string
  starts_at?: string | null
  ends_at?: string | null
  payment_method?: string | null
  payment_provider?: string | null
  payment_reference?: string | null
  notes?: string | null
  listing_boost_products?: ProductRow | ProductRow[] | null
  listings?: ListingRow | ListingRow[] | null
}

function safeRedirect(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : fallback
}

function withFlash(path: string, flash: string) {
  const url = new URL(path, "http://local")
  url.searchParams.set("flash", flash)
  return `${url.pathname}${url.search}`
}

function toMinorUnits(value: number) {
  const amount = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid payment amount")
  return amount
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

async function requireAdmin() {
  const { supabase, user } = await requireUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
  if (!profile?.is_admin) redirect("/dashboard")

  return { supabase, user }
}

async function getOwnedListing(supabase: Awaited<ReturnType<typeof createClient>>, listingId: string, sellerId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, seller_id, slug, title, is_vip, vip_until, promoted_until, featured_until, featured_slot, home_banner_until, home_banner_slot")
    .eq("id", listingId)
    .eq("seller_id", sellerId)
    .eq("status", "active")
    .maybeSingle()

  if (error) throw error
  return data as ListingRow | null
}

async function getBoostProduct(supabase: Awaited<ReturnType<typeof createClient>>, productId: string) {
  const { data, error } = await supabase
    .from("listing_boost_products")
    .select("id, name, placement, duration_days, price, currency, is_active")
    .eq("id", productId)
    .eq("is_active", true)
    .maybeSingle()

  if (error) throw error
  return data as ProductRow | null
}

export async function createBoostOrderAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "")
  const productId = String(formData.get("productId") || "")
  const requestedPaymentMethod = String(formData.get("paymentMethod") || "bank_transfer")
  const paymentMethod = ["flitt", "tbc_checkout", "bank_transfer", "manual_cash", "card_external"].includes(requestedPaymentMethod)
    ? requestedPaymentMethod
    : "bank_transfer"
  const rawPaymentReference = String(formData.get("paymentReference") || "").trim()
  const paymentReference = rawPaymentReference || buildSuggestedBoostReference(listingId, productId)
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000)
  const nextPath = safeRedirect(String(formData.get("nextPath") || `/dashboard/listings/${listingId}/promote`), `/dashboard/listings/${listingId}/promote`)

  if (!listingId || !productId) redirect(withFlash(nextPath, "missing"))

  const { supabase, user } = await requireUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`)

  try {
    if (paymentMethod === "bank_transfer" && !getBoostPaymentConfig().hasBankDetails) {
      redirect(withFlash(nextPath, "payment_unavailable"))
    }
    await enforceRateLimit(supabase, "payment_create")
    await reconcileExpiredBoostOrders()

    const [listing, product] = await Promise.all([
      getOwnedListing(supabase, listingId, user.id),
      getBoostProduct(supabase, productId),
    ])

    if (!listing || !product) redirect(withFlash(nextPath, "not_found"))

    const { data: existing, error: existingError } = await supabase
      .from("listing_boost_orders")
      .select("id")
      .eq("listing_id", listingId)
      .eq("seller_id", user.id)
      .eq("product_id", productId)
      .in("status", ["pending_payment", "under_review", "approved"])
      .limit(1)

    if (existingError) throw existingError
    if ((existing ?? []).length > 0) redirect(withFlash(nextPath, "already_requested"))

    const trustedClient = createAdminClient()

    if (paymentMethod === "flitt") {
      getFlittCheckoutConfig()
      const orderId = randomUUID()
      const amountMinor = toMinorUnits(product.price)
      const checkoutStartedAt = new Date().toISOString()

      const { error: orderError } = await trustedClient.from("listing_boost_orders").insert({
        id: orderId,
        listing_id: listingId,
        seller_id: user.id,
        product_id: product.id,
        status: "pending_payment",
        payment_method: "flitt",
        payment_reference: paymentReference || null,
        amount: product.price,
        currency: product.currency,
        notes: notes || null,
        payment_provider: "flitt",
        provider_status: "created",
        checkout_session_started_at: checkoutStartedAt,
        last_payment_sync_at: checkoutStartedAt,
      })
      if (orderError) throw orderError

      const checkoutUrl = await createFlittBoostCheckoutSession({
        id: orderId,
        sellerId: user.id,
        amountMinor,
        currency: product.currency,
        paymentReference: paymentReference || null,
        description: `SamoSell ${product.name}`,
      })
      revalidatePath("/dashboard/billing")
      await recordGrowthCheckout(user.id, orderId, "boost")
      redirect(checkoutUrl)
    }

    if (paymentMethod === "tbc_checkout") {
      if (!isTbcCheckoutEnabled()) {
        redirect(withFlash(nextPath, "tbc_disabled"))
      }

      const orderId = randomUUID()
      const checkoutStartedAt = new Date().toISOString()
      const { error } = await trustedClient.from("listing_boost_orders").insert({
        id: orderId,
        listing_id: listingId,
        seller_id: user.id,
        product_id: product.id,
        status: "pending_payment",
        payment_method: paymentMethod,
        payment_reference: paymentReference || null,
        amount: product.price,
        currency: product.currency,
        notes: notes || null,
        payment_provider: "tbc_checkout",
        provider_status: "Created",
        checkout_session_started_at: checkoutStartedAt,
        last_payment_sync_at: checkoutStartedAt,
      })

      if (error) throw error

      let checkoutUrl = ""
      try {
        const { data: checkout, approvalUrl } = await createTbcPayment({
          orderId,
          amount: Number(product.price),
          currency: product.currency,
          description: `SamoSell ${orderId.slice(0, 8)}`,
          extra: paymentReference,
          language: "KA",
        })
        checkoutUrl = approvalUrl

        const { error: checkoutUpdateError } = await trustedClient
          .from("listing_boost_orders")
          .update({
            provider_payment_id: checkout.payId ?? null,
            provider_checkout_url: approvalUrl,
            provider_status: checkout.status ?? "Created",
            provider_result_code: checkout.resultCode ?? null,
            last_payment_sync_at: new Date().toISOString(),
          })
          .eq("id", orderId)

        if (checkoutUpdateError) throw checkoutUpdateError

        const { error: eventError } = await trustedClient.from("listing_boost_order_events").insert({
          order_id: orderId,
          seller_id: user.id,
          source: "create",
          event_type: "checkout_created",
          provider_status: checkout.status ?? "Created",
          provider_result_code: checkout.resultCode ?? null,
          message: "TBC Checkout session created successfully.",
          payload: { providerPaymentId: checkout.payId ?? null, paymentReference },
          event_key: `${orderId}:create:checkout_created:${checkout.payId ?? "unknown"}`,
        })

        if (eventError) throw eventError

      } catch (checkoutError) {
        const failureReason = "Checkout creation could not be confirmed. Manual reconciliation required."
        await trustedClient
          .from("listing_boost_orders")
          .update({
            status: "under_review",
            failure_reason: failureReason,
            admin_note: "Checkout creation outcome uncertain. Verify merchant payment reference before allowing a new order.",
          })
          .eq("id", orderId)
        throw checkoutError
      }

      revalidatePath("/dashboard/billing")
      await recordGrowthCheckout(user.id, orderId, "boost")
      redirect(checkoutUrl)
    }

    const { error } = await trustedClient.from("listing_boost_orders").insert({
      listing_id: listingId,
      seller_id: user.id,
      product_id: product.id,
      status: "pending_payment",
      payment_method: paymentMethod,
      payment_reference: paymentReference || null,
      amount: product.price,
      currency: product.currency,
      notes: notes || null,
    })

    if (error) throw error
  } catch (error) {
    unstable_rethrow(error)
    const message = error instanceof Error ? humanizeSupabaseError(error.message) : "ოპერაცია ვერ შესრულდა."
    redirect(withFlash(nextPath, encodeURIComponent(message)))
  }

  revalidatePath("/")
  revalidatePath("/catalog")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/listings")
  revalidatePath(`/dashboard/listings/${listingId}/promote`)
  revalidatePath("/dashboard/billing")
  revalidatePath("/admin")
  revalidatePath("/admin/boosts")
  redirect(withFlash(nextPath, "requested"))
}

export async function resumeBoostCheckoutAction(formData: FormData) {
  const orderId = String(formData.get("orderId") ?? "").trim()
  const nextPath = safeRedirect(String(formData.get("nextPath") ?? "/dashboard/billing"), "/dashboard/billing")
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    redirect(withFlash(nextPath, "checkout_unavailable"))
  }
  if (formData.get("confirmUnpaid") !== "yes") redirect(withFlash(nextPath, "confirm_unpaid"))

  const { supabase, user } = await requireUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`)

  let checkoutUrl: string
  try {
    await enforceRateLimit(supabase, "payment_create")
    getFlittCheckoutConfig()
    const { data, error } = await supabase.from("listing_boost_orders")
      .select("id, listing_id, seller_id, product_id, status, payment_method, payment_provider, provider_payment_id, provider_checkout_url, paid_at, approved_at, amount, currency, payment_reference")
      .eq("id", orderId)
      .eq("seller_id", user.id)
      .maybeSingle()
    if (error) throw error
    const order = data as BoostOrder | null
    if (!order || !canResumeManualBoostCheckout(order)) redirect(withFlash(nextPath, "checkout_unavailable"))

    const [listing, product] = await Promise.all([
      getOwnedListing(supabase, order.listing_id, user.id),
      getBoostProduct(supabase, order.product_id),
    ])
    if (!listing || !product) redirect(withFlash(nextPath, "checkout_listing_inactive"))
    const amountMinor = toMinorUnits(order.amount)
    const now = new Date().toISOString()
    const admin = createAdminClient()
    // Compare-and-set claims the original unpaid order once. A second tab or
    // concurrent administrator payment confirmation cannot create a second session.
    const { data: claimed, error: claimError } = await admin.from("listing_boost_orders")
      .update({
        payment_method: "flitt",
        payment_provider: "flitt",
        provider_status: "created",
        checkout_session_started_at: now,
        last_payment_sync_at: now,
      })
      .eq("id", order.id)
      .eq("seller_id", user.id)
      .eq("status", "pending_payment")
      .eq("payment_method", order.payment_method)
      .eq("amount", order.amount)
      .eq("currency", order.currency)
      .is("payment_provider", null)
      .is("provider_payment_id", null)
      .is("provider_checkout_url", null)
      .is("paid_at", null)
      .is("approved_at", null)
      .select("id")
      .maybeSingle()
    if (claimError) throw claimError
    if (!claimed) redirect(withFlash(nextPath, "checkout_unavailable"))

    checkoutUrl = await createFlittBoostCheckoutSession({
      id: order.id,
      sellerId: user.id,
      amountMinor,
      currency: order.currency,
      paymentReference: order.payment_reference,
      description: `SamoSell ${product.name}`,
    })
    await recordGrowthCheckout(user.id, order.id, "boost")
  } catch (error) {
    unstable_rethrow(error)
    console.error("[boost] checkout recovery failed", { orderId, message: error instanceof Error ? error.message : "unknown_error" })
    redirect(withFlash(nextPath, "checkout_failed"))
  }

  revalidatePath("/dashboard/billing")
  revalidatePath(nextPath.split("?")[0])
  redirect(checkoutUrl)
}

export async function adminReviewBoostOrderAction(formData: FormData) {
  const orderId = String(formData.get("orderId") || "")
  const decision = String(formData.get("decision") || "")
  const adminNote = String(formData.get("adminNote") || "").trim()
  const featuredSlotRaw = String(formData.get("featuredSlot") || "").trim()
  const nextPath = safeRedirect(String(formData.get("nextPath") || "/admin/boosts"), "/admin/boosts")
  const featuredSlot = featuredSlotRaw ? Number(featuredSlotRaw) : null

  if (!orderId || !decision) redirect(withFlash(nextPath, "missing"))

  const { supabase, user } = await requireAdmin()

  try {
    const { data: order, error } = await supabase
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
        payment_method,
        payment_provider,
        payment_reference,
        notes,
        listing_boost_products!inner(id, name, placement, duration_days, price, currency, is_active),
        listings!inner(id, seller_id, slug, title, is_vip, vip_until, promoted_until, featured_until, featured_slot, home_banner_until, home_banner_slot)
      `)
      .eq("id", orderId)
      .maybeSingle()

    if (error) throw error
    if (!order) redirect(withFlash(nextPath, "not_found"))

    const orderRow = order as unknown as AdminOrderRow
    const reviewableStatuses = ["pending_payment", "under_review", "approved"]

    if (decision === "review") {
      if (!reviewableStatuses.includes(orderRow.status)) redirect(withFlash(nextPath, "invalid_status"))
      const { error: reviewError } = await createAdminClient()
        .from("listing_boost_orders")
        .update({ status: "under_review", admin_note: adminNote || null, reviewed_by: user.id })
        .eq("id", orderId)
        .eq("status", orderRow.status)

      if (reviewError) throw reviewError
    } else if (decision === "reject") {
      if (!reviewableStatuses.includes(orderRow.status)) redirect(withFlash(nextPath, "invalid_status"))
      const { error: rejectError } = await createAdminClient()
        .from("listing_boost_orders")
        .update({ status: "rejected", admin_note: adminNote || null, reviewed_by: user.id, approved_at: null })
        .eq("id", orderId)
        .eq("status", orderRow.status)

      if (rejectError) throw rejectError
    } else if (decision === "activate") {
      if (orderRow.payment_provider === "tbc_checkout" || orderRow.payment_provider === "flitt") {
        redirect(withFlash(nextPath, "tbc_sync_required"))
      }
      const product = Array.isArray(orderRow.listing_boost_products) ? orderRow.listing_boost_products[0] : orderRow.listing_boost_products
      const listing = Array.isArray(orderRow.listings) ? orderRow.listings[0] : orderRow.listings
      if (!product || !listing) redirect(withFlash(nextPath, "not_found"))
      await activateBoostOrder({
        orderId,
        activationSource: "admin",
        reviewedBy: user.id,
        featuredSlot: Number.isFinite(featuredSlot as number) ? featuredSlot : null,
      })

      if (adminNote) {
        const { error: noteError } = await createAdminClient()
          .from("listing_boost_orders")
          .update({ admin_note: adminNote })
          .eq("id", orderId)
        if (noteError) throw noteError
      }
    } else {
      redirect(withFlash(nextPath, "missing"))
    }
  } catch (error) {
    unstable_rethrow(error)
    const message = error instanceof Error ? humanizeSupabaseError(error.message) : "ოპერაცია ვერ შესრულდა."
    redirect(withFlash(nextPath, encodeURIComponent(message)))
  }

  revalidatePath("/")
  revalidatePath("/catalog")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/listings")
  revalidatePath("/dashboard/billing")
  revalidatePath("/admin")
  revalidatePath("/admin/boosts")
  redirect(withFlash(nextPath, decision === "activate" ? "activated" : decision === "reject" ? "rejected" : "reviewing"))
}

export async function refreshBoostOrderStatusAction(formData: FormData) {
  const orderId = String(formData.get("orderId") || "").trim()
  const requestedNextPath = String(formData.get("nextPath") || "/dashboard/billing")
  const nextPath = safeRedirect(requestedNextPath, "/dashboard/billing")
  const mode = String(formData.get("mode") || "seller") === "admin" ? "admin" : "seller"

  if (!orderId) redirect(withFlash(nextPath, "tbc_sync_missing"))

  const auth = mode === "admin" ? await requireAdmin() : await requireUser()
  if (!auth.user) redirect(`/login?next=${encodeURIComponent(nextPath)}`)

  const query = auth.supabase
    .from("listing_boost_orders")
    .select("id, seller_id, payment_provider, provider_payment_id, status")
    .eq("id", orderId)

  const scopedQuery = mode === "admin" ? query : query.eq("seller_id", auth.user.id)
  const { data: order, error } = await scopedQuery.maybeSingle()

  if (error) {
    const message = error instanceof Error ? humanizeSupabaseError(error.message) : "ოპერაცია ვერ შესრულდა."
    redirect(withFlash(nextPath, encodeURIComponent(message)))
  }

  if (!order) redirect(withFlash(nextPath, "tbc_sync_missing"))
  if (order.payment_provider !== "tbc_checkout" || !order.provider_payment_id) {
    redirect(withFlash(nextPath, "tbc_sync_unavailable"))
  }

  if (!isTbcCheckoutEnabled()) redirect(withFlash(nextPath, "tbc_disabled"))

  try {
    const result = await syncBoostOrderFromTbcByOrderId(orderId, mode === "admin" ? "manual_admin_sync" : "manual_sync")
    const providerStatus = String(result?.payment?.status ?? ((result?.order as { provider_status?: string | null } | null)?.provider_status ?? ""))

    revalidatePath("/")
    revalidatePath("/catalog")
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/listings")
    revalidatePath("/dashboard/billing")
    revalidatePath("/admin")
    revalidatePath("/admin/boosts")

    const listingId = (result?.order as { listing_id?: string | null } | null)?.listing_id
    if (listingId) {
      revalidatePath(`/dashboard/listings/${listingId}/promote`)
    }

    if (result?.order?.status === "active") redirect(withFlash(nextPath, "tbc_sync_active"))
    if (providerStatus === "Failed" || providerStatus === "Expired" || providerStatus === "Returned" || providerStatus === "PartialReturned") {
      redirect(withFlash(nextPath, "tbc_sync_failed"))
    }

    redirect(withFlash(nextPath, "tbc_sync_pending"))
  } catch (error) {
    unstable_rethrow(error)
    const message = error instanceof Error ? humanizeSupabaseError(error.message) : "სტატუსის გადამოწმება ვერ შესრულდა."
    redirect(withFlash(nextPath, encodeURIComponent(message)))
  }
}
