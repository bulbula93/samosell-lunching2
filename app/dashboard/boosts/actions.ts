"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { buildBoostDurationEndsAt, buildSuggestedBoostReference } from "@/lib/boosts"
import { humanizeSupabaseError } from "@/lib/listings"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createTbcPayment, isTbcCheckoutEnabled } from "@/lib/tbc"
import { syncBoostOrderFromTbcByOrderId } from "@/lib/tbc-sync"

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
  payment_reference?: string | null
  notes?: string | null
  listing_boost_products?: ProductRow | ProductRow[] | null
  listings?: ListingRow | ListingRow[] | null
}

function safeRedirect(value: string, fallback: string) {
  return value && value.startsWith("/") ? value : fallback
}

function withFlash(path: string, flash: string) {
  const url = new URL(path, "http://local")
  url.searchParams.set("flash", flash)
  return `${url.pathname}${url.search}`
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
    .select("id, seller_id, slug, title, is_vip, vip_until, promoted_until, featured_until, featured_slot")
    .eq("id", listingId)
    .eq("seller_id", sellerId)
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
  const paymentMethod = requestedPaymentMethod === "tbc_checkout" ? "tbc_checkout" : requestedPaymentMethod
  const rawPaymentReference = String(formData.get("paymentReference") || "").trim()
  const paymentReference = rawPaymentReference || buildSuggestedBoostReference(listingId, productId)
  const notes = String(formData.get("notes") || "").trim()
  const nextPath = safeRedirect(String(formData.get("nextPath") || `/dashboard/listings/${listingId}/promote`), `/dashboard/listings/${listingId}/promote`)

  if (!listingId || !productId) redirect(withFlash(nextPath, "missing"))

  const { supabase, user } = await requireUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`)

  try {
    const [listing, product] = await Promise.all([
      getOwnedListing(supabase, listingId, user.id),
      getBoostProduct(supabase, productId),
    ])

    if (!listing || !product) redirect(withFlash(nextPath, "not_found"))

    const { data: existing } = await supabase
      .from("listing_boost_orders")
      .select("id")
      .eq("listing_id", listingId)
      .eq("seller_id", user.id)
      .eq("product_id", productId)
      .in("status", ["pending_payment", "under_review", "approved", "active"])
      .limit(1)

    if ((existing ?? []).length > 0) redirect(withFlash(nextPath, "already_requested"))

    if (paymentMethod === "tbc_checkout") {
      if (!isTbcCheckoutEnabled()) {
        redirect(withFlash(nextPath, encodeURIComponent("TBC Checkout კონფიგურაცია არ არის დასრულებული.")))
      }

      const orderId = randomUUID()
      const { data: checkout, approvalUrl } = await createTbcPayment({
        orderId,
        amount: Number(product.price),
        currency: product.currency,
        description: `SamoSell Boost ${orderId.slice(0, 8)}`,
        extra: paymentReference,
        language: "KA",
      })

      const checkoutStartedAt = new Date().toISOString()
      const { error } = await supabase.from("listing_boost_orders").insert({
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
        provider_payment_id: checkout.payId ?? null,
        provider_checkout_url: approvalUrl,
        provider_status: checkout.status ?? "Created",
        provider_result_code: checkout.resultCode ?? null,
        checkout_session_started_at: checkoutStartedAt,
        last_payment_sync_at: checkoutStartedAt,
      })

      if (error) throw error

      try {
        await createAdminClient().from("listing_boost_order_events").insert({
          order_id: orderId,
          seller_id: user.id,
          source: "create",
          event_type: "checkout_created",
          provider_status: checkout.status ?? "Created",
          provider_result_code: checkout.resultCode ?? null,
          message: "TBC Checkout session created successfully.",
          payload: { approvalUrl, providerPaymentId: checkout.payId ?? null, paymentReference },
        })
      } catch {
        // Optional audit table may not exist yet.
      }

      revalidatePath("/dashboard/billing")
      redirect(approvalUrl)
    }

    const { error } = await supabase.from("listing_boost_orders").insert({
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
        payment_reference,
        notes,
        listing_boost_products!inner(id, name, placement, duration_days, price, currency, is_active),
        listings!inner(id, seller_id, slug, title, is_vip, vip_until, promoted_until, featured_until, featured_slot)
      `)
      .eq("id", orderId)
      .maybeSingle()

    if (error) throw error
    if (!order) redirect(withFlash(nextPath, "not_found"))

    const orderRow = order as unknown as AdminOrderRow

    if (decision === "review") {
      const { error: reviewError } = await supabase
        .from("listing_boost_orders")
        .update({ status: "under_review", admin_note: adminNote || null, reviewed_by: user.id })
        .eq("id", orderId)

      if (reviewError) throw reviewError
    } else if (decision === "reject") {
      const { error: rejectError } = await supabase
        .from("listing_boost_orders")
        .update({ status: "rejected", admin_note: adminNote || null, reviewed_by: user.id, approved_at: null })
        .eq("id", orderId)

      if (rejectError) throw rejectError
    } else if (decision === "activate") {
      const product = Array.isArray(orderRow.listing_boost_products) ? orderRow.listing_boost_products[0] : orderRow.listing_boost_products
      const listing = Array.isArray(orderRow.listings) ? orderRow.listings[0] : orderRow.listings
      if (!product || !listing) redirect(withFlash(nextPath, "not_found"))
      const durationDays = Number(product.duration_days ?? 0)
      if (!durationDays) redirect(withFlash(nextPath, "bad_product"))

      const placement = String(product.placement)
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
        nextListingUpdate.featured_slot = Number.isFinite(featuredSlot as number) ? featuredSlot : listing.featured_slot ?? null
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
                  .at(-1) ?? new Date().toISOString()

      const nowIso = new Date().toISOString()

      const { error: listingError } = await supabase.from("listings").update(nextListingUpdate).eq("id", listing.id)
      if (listingError) throw listingError

      const { error: orderUpdateError } = await supabase
        .from("listing_boost_orders")
        .update({
          status: "active",
          admin_note: adminNote || null,
          reviewed_by: user.id,
          approved_at: nowIso,
          starts_at: nowIso,
          ends_at: resolvedEndsAt,
        })
        .eq("id", orderId)

      if (orderUpdateError) throw orderUpdateError
    } else {
      redirect(withFlash(nextPath, "missing"))
    }
  } catch (error) {
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

  try {
    const result = await syncBoostOrderFromTbcByOrderId(orderId, "manual_sync")
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
    const message = error instanceof Error ? humanizeSupabaseError(error.message) : "სტატუსის გადამოწმება ვერ შესრულდა."
    redirect(withFlash(nextPath, encodeURIComponent(message)))
  }
}
