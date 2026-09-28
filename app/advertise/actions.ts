"use server"

import { randomUUID } from "node:crypto"
import { redirect } from "next/navigation"
import { requireAuthenticatedUser } from "@/lib/auth"
import {
  AD_IMAGE_BUCKET,
  MAX_AD_IMAGE_FILE_SIZE_BYTES,
  validateAdminAdInput,
} from "@/lib/admin-ads"
import {
  createFlittCheckout,
  getFlittCheckoutConfig,
  getFlittReadiness,
} from "@/lib/flitt"
import {
  detectListingImageMimeType,
  imageExtensionForMimeType,
  type ListingImageMimeType,
} from "@/lib/listing-form"
import { enforceRateLimit } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"

const ADVERTISE_PATH = "/advertise"
const PRODUCT_ID = "home_brand_ad_7d"

function withFlash(code: string) {
  const params = new URLSearchParams({ flash: code })
  return `${ADVERTISE_PATH}?${params.toString()}`
}

function toMinorUnits(value: number) {
  const amount = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid payment amount")
  return amount
}

async function uploadAdImage(file: File, adId: string) {
  if (file.size <= 0 || file.size > MAX_AD_IMAGE_FILE_SIZE_BYTES) {
    return { ok: false as const, code: "image_size" }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const detectedMime = detectListingImageMimeType(bytes)
  if (!detectedMime || detectedMime !== file.type) {
    return { ok: false as const, code: "image_type" }
  }

  const extension = imageExtensionForMimeType(detectedMime as ListingImageMimeType)
  const path = `${adId}/${randomUUID()}.${extension}`
  const admin = createAdminClient()
  const { error } = await admin.storage.from(AD_IMAGE_BUCKET).upload(path, bytes, {
    contentType: detectedMime,
    cacheControl: "31536000",
    upsert: false,
  })
  if (error) return { ok: false as const, code: "upload_failed" }

  const imageUrl = admin.storage.from(AD_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  return { ok: true as const, path, imageUrl }
}

export async function submitSelfServiceAdAction(formData: FormData) {
  const { supabase, user } = await requireAuthenticatedUser(ADVERTISE_PATH)
  await enforceRateLimit(supabase, "payment_create")

  const readiness = getFlittReadiness()
  const checkoutEnabled = readiness.mode === "test" ? readiness.sandboxEnabled : readiness.liveEnabled
  if (!checkoutEnabled) redirect(withFlash("payment_unavailable"))
  if (String(formData.get("acceptAdTerms") ?? "") !== "yes") redirect(withFlash("terms_required"))

  const validation = validateAdminAdInput({
    advertiserName: formData.get("advertiserName"),
    title: formData.get("title"),
    description: formData.get("description"),
    placementKey: "home_hero_left",
    targetUrl: formData.get("targetUrl"),
    priority: 0,
  })
  if (!validation.ok) redirect(withFlash(`invalid_${validation.code}`))

  const admin = createAdminClient()
  const { data: product, error: productError } = await admin
    .from("ad_products")
    .select("id, name, duration_days, price, currency, description, is_active")
    .eq("id", PRODUCT_ID)
    .eq("is_active", true)
    .maybeSingle()

  if (productError || !product) redirect(withFlash("product_unavailable"))

  const price = Number(product.price)
  if (!Number.isFinite(price) || price <= 0) redirect(withFlash("product_unavailable"))

  const adId = randomUUID()
  const orderId = randomUUID()
  const imageEntry = formData.get("image")
  const image = imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null
  const upload = image ? await uploadAdImage(image, adId) : null
  if (upload && !upload.ok) redirect(withFlash(upload.code))

  const cleanup = async () => {
    await Promise.all([
      admin.from("ad_orders").delete().eq("id", orderId),
      admin.from("ads").delete().eq("id", adId),
      upload?.ok ? admin.storage.from(AD_IMAGE_BUCKET).remove([upload.path]) : Promise.resolve(),
    ])
  }

  const { error: adError } = await admin.from("ads").insert({
    id: adId,
    placement_key: "home_hero_left",
    title: validation.data.title,
    description: validation.data.description,
    target_url: validation.data.targetUrl,
    priority: 0,
    advertiser_name: validation.data.advertiserName,
    image_url: upload?.ok ? upload.imageUrl : null,
    is_active: false,
    submitted_by: user.id,
    review_status: "pending",
  })

  if (adError) {
    if (upload?.ok) await admin.storage.from(AD_IMAGE_BUCKET).remove([upload.path])
    console.error("[advertise] ad insert failed", { code: adError.code, userId: user.id })
    redirect(withFlash("save_failed"))
  }

  const { error: orderError } = await admin.from("ad_orders").insert({
    id: orderId,
    ad_id: adId,
    user_id: user.id,
    product_id: product.id,
    status: "pending_payment",
    amount: price,
    currency: product.currency,
    product_name_snapshot: product.name,
    duration_days_snapshot: product.duration_days,
    description_snapshot: product.description,
    payment_provider: "flitt",
  })

  if (orderError) {
    await cleanup()
    console.error("[advertise] ad order insert failed", { code: orderError.code, userId: user.id })
    redirect(withFlash("save_failed"))
  }

  let config
  try {
    config = getFlittCheckoutConfig()
  } catch {
    await cleanup()
    redirect(withFlash("payment_unavailable"))
  }

  const amountMinor = toMinorUnits(price)
  const { error: attemptError } = await admin.from("flitt_payment_attempts").insert({
    order_id: orderId,
    ad_order_id: orderId,
    user_id: user.id,
    mode: config.mode,
    purpose: "ad_order",
    amount: amountMinor,
    currency: product.currency,
    merchant_id: config.merchantId,
    status: "pending",
  })

  if (attemptError) {
    await cleanup()
    console.error("[advertise] Flitt attempt insert failed", { code: attemptError.code, orderId })
    redirect(withFlash("payment_failed"))
  }

  let checkoutUrl: string
  try {
    const checkout = await createFlittCheckout({
      orderId,
      amount: amountMinor,
      currency: product.currency,
      description: `SamoSell ${product.name} / 7 days`,
    })
    checkoutUrl = checkout.checkoutUrl

    const now = new Date().toISOString()
    const [{ error: attemptUpdateError }, { error: orderUpdateError }] = await Promise.all([
      admin
        .from("flitt_payment_attempts")
        .update({ provider_payment_id: checkout.paymentId, updated_at: now })
        .eq("order_id", orderId),
      admin
        .from("ad_orders")
        .update({
          provider_payment_id: checkout.paymentId,
          provider_status: "created",
          updated_at: now,
        })
        .eq("id", orderId),
    ])

    if (attemptUpdateError || orderUpdateError) {
      throw attemptUpdateError ?? orderUpdateError ?? new Error("payment persistence failed")
    }
  } catch (error) {
    const now = new Date().toISOString()
    await Promise.all([
      admin
        .from("flitt_payment_attempts")
        .update({ status: "failed", updated_at: now })
        .eq("order_id", orderId),
      admin
        .from("ad_orders")
        .update({ status: "payment_failed", provider_status: "checkout_failed", updated_at: now })
        .eq("id", orderId),
    ])
    console.error("[advertise] Flitt checkout failed", {
      orderId,
      message: error instanceof Error ? error.message : "unknown_error",
    })
    redirect(withFlash("payment_failed"))
  }

  redirect(checkoutUrl)
}
