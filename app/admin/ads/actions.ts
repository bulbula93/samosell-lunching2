"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdminUser } from "@/lib/auth"
import {
  AD_IMAGE_BUCKET,
  createSevenDayAdSchedule,
  isAdId,
  MAX_AD_IMAGE_FILE_SIZE_BYTES,
  validateAdminAdInput,
} from "@/lib/admin-ads"
import {
  detectListingImageMimeType,
  imageExtensionForMimeType,
  type ListingImageMimeType,
} from "@/lib/listing-form"
import { reverseFlittOrder } from "@/lib/flitt"
import { createAdminClient } from "@/lib/supabase/admin"

const ADS_ADMIN_PATH = "/admin/ads"

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

function adminAdsRedirect(flash: string, editId?: string): never {
  const params = new URLSearchParams({ flash })
  if (editId && isAdId(editId)) params.set("edit", editId)
  redirect(`${ADS_ADMIN_PATH}?${params.toString()}`)
}

function storagePathFromPublicUrl(value?: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    const marker = `/storage/v1/object/public/${AD_IMAGE_BUCKET}/`
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex === -1) return null
    const path = decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
    return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(path) ? path : null
  } catch {
    return null
  }
}

async function validateAndUploadImage(
  file: File,
  adId: string,
): Promise<
  | { ok: true; path: string; imageUrl: string }
  | { ok: false; error: "image_size" | "image_type" | "upload_failed" }
> {
  if (file.size <= 0 || file.size > MAX_AD_IMAGE_FILE_SIZE_BYTES) return { ok: false, error: "image_size" }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const detectedMime = detectListingImageMimeType(bytes)
  if (!detectedMime || detectedMime !== file.type) return { ok: false, error: "image_type" }

  const extension = imageExtensionForMimeType(detectedMime as ListingImageMimeType)
  const path = `${adId}/${crypto.randomUUID()}.${extension}`
  const admin = createAdminClient()
  const { error } = await admin.storage.from(AD_IMAGE_BUCKET).upload(path, bytes, {
    contentType: detectedMime,
    cacheControl: "31536000",
    upsert: false,
  })
  if (error) return { ok: false, error: "upload_failed" }

  const imageUrl = admin.storage.from(AD_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  return { ok: true, path, imageUrl }
}

function revalidateAdSurfaces() {
  revalidatePath(ADS_ADMIN_PATH)
  revalidatePath("/")
  revalidatePath("/catalog")
  revalidatePath("/dashboard/listings/new")
  revalidatePath("/dashboard/ads")
  revalidatePath("/advertise")
}

export async function saveAdminAdAction(formData: FormData) {
  await requireAdminUser("/dashboard")

  const requestedId = readText(formData, "adId")
  const editing = Boolean(requestedId)
  if (editing && !isAdId(requestedId)) adminAdsRedirect("invalid_id")

  const validation = validateAdminAdInput({
    advertiserName: formData.get("advertiserName"),
    title: formData.get("title"),
    description: formData.get("description"),
    placementKey: formData.get("placementKey"),
    targetUrl: formData.get("targetUrl"),
    priority: formData.get("priority"),
  })
  if (!validation.ok) adminAdsRedirect(`invalid_${validation.code}`, editing ? requestedId : undefined)

  const admin = createAdminClient()
  const adId = editing ? requestedId : crypto.randomUUID()
  const { data: existing, error: existingError } = editing
    ? await admin.from("ads").select("id, image_url, submitted_by, placement_key, priority").eq("id", adId).maybeSingle()
    : { data: null, error: null }
  if (existingError) adminAdsRedirect("save_failed", adId)
  if (editing && !existing) adminAdsRedirect("not_found")

  const imageEntry = formData.get("image")
  const image = imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null
  const upload = image ? await validateAndUploadImage(image, adId) : null
  if (upload && !upload.ok) adminAdsRedirect(upload.error, editing ? adId : undefined)

  const payload = {
    placement_key: existing?.submitted_by ? existing.placement_key : validation.data.placementKey,
    title: validation.data.title,
    description: validation.data.description,
    target_url: validation.data.targetUrl,
    priority: existing?.submitted_by ? existing.priority : validation.data.priority,
    advertiser_name: validation.data.advertiserName,
    image_url: upload?.ok ? upload.imageUrl : existing?.image_url ?? null,
  }

  const response = editing
    ? await admin.from("ads").update(payload).eq("id", adId).select("id").maybeSingle()
    : await admin.from("ads").insert({ id: adId, ...payload, is_active: false }).select("id").maybeSingle()

  if (response.error || !response.data) {
    if (upload?.ok) await admin.storage.from(AD_IMAGE_BUCKET).remove([upload.path])
    adminAdsRedirect("save_failed", editing ? adId : undefined)
  }

  const previousPath = upload?.ok ? storagePathFromPublicUrl(existing?.image_url) : null
  if (previousPath) {
    const { error } = await admin.storage.from(AD_IMAGE_BUCKET).remove([previousPath])
    if (error) console.error("[admin ads] previous image cleanup failed", { adId })
  }

  revalidateAdSurfaces()
  adminAdsRedirect(editing ? "updated" : "created")
}

export async function launchAdminAdAction(formData: FormData) {
  const { user } = await requireAdminUser("/dashboard")
  const adId = readText(formData, "adId")
  if (!isAdId(adId)) adminAdsRedirect("invalid_id")

  const admin = createAdminClient()
  const { data: ad, error: adError } = await admin
    .from("ads")
    .select("id, submitted_by")
    .eq("id", adId)
    .maybeSingle()

  if (adError || !ad) adminAdsRedirect("not_found")

  if (ad.submitted_by) {
    const { error } = await admin.rpc("approve_self_service_ad", {
      p_ad_id: adId,
      p_reviewed_by: user.id,
    })

    if (error) {
      if (error.code === "42501") adminAdsRedirect("unpaid", adId)
      adminAdsRedirect("launch_failed", adId)
    }
  } else {
    const schedule = createSevenDayAdSchedule()
    const { data, error } = await admin
      .from("ads")
      .update({ is_active: true, starts_at: schedule.startsAt, ends_at: schedule.endsAt })
      .eq("id", adId)
      .select("id")
      .maybeSingle()

    if (error || !data) adminAdsRedirect("not_found")
  }

  revalidateAdSurfaces()
  adminAdsRedirect("launched")
}

export async function rejectSelfServiceAdAction(formData: FormData) {
  const { user } = await requireAdminUser("/dashboard")
  const adId = readText(formData, "adId")
  const reason = readText(formData, "reason")

  if (!isAdId(adId)) adminAdsRedirect("invalid_id")
  if (reason.length < 5 || reason.length > 500) adminAdsRedirect("invalid_rejection_reason", adId)

  const admin = createAdminClient()
  const { data: rejection, error: rejectionError } = await admin.rpc("reject_self_service_ad", {
    p_ad_id: adId,
    p_reviewed_by: user.id,
    p_reason: reason,
  })

  if (rejectionError) {
    if (rejectionError.code === "P0002") adminAdsRedirect("not_found", adId)
    adminAdsRedirect("reject_failed", adId)
  }

  const result = rejection as { order_id?: string; needs_refund?: boolean } | null
  const orderId = String(result?.order_id ?? "")
  if (!orderId || result?.needs_refund === false) {
    revalidateAdSurfaces()
    adminAdsRedirect("rejected_refunded")
  }

  const [{ data: order, error: orderError }, { data: attempt, error: attemptError }] = await Promise.all([
    admin
      .from("ad_orders")
      .select("id, amount, currency, refund_status")
      .eq("id", orderId)
      .maybeSingle(),
    admin
      .from("flitt_payment_attempts")
      .select("order_id, amount, currency, merchant_id, status")
      .eq("ad_order_id", orderId)
      .eq("purpose", "ad_order")
      .maybeSingle(),
  ])

  if (orderError || attemptError || !order || !attempt) {
    await admin
      .from("ad_orders")
      .update({ refund_status: "failed", refund_error: "refund_context_missing", updated_at: new Date().toISOString() })
      .eq("id", orderId)
    revalidateAdSurfaces()
    adminAdsRedirect("reject_refund_failed", adId)
  }

  try {
    if (attempt.status !== "reversed") {
      await reverseFlittOrder({
        orderId: String(attempt.order_id),
        amount: Number(attempt.amount),
        currency: String(attempt.currency),
        merchantId: String(attempt.merchant_id),
        reverseId: `adrej-${orderId}`.slice(0, 50),
        comment: `SamoSell ad rejected: ${reason}`,
      })

      const now = new Date().toISOString()
      const { error: attemptUpdateError } = await admin
        .from("flitt_payment_attempts")
        .update({
          status: "reversed",
          provider_status: "reversed",
          response_status: "success",
          updated_at: now,
        })
        .eq("ad_order_id", orderId)
        .eq("purpose", "ad_order")

      if (attemptUpdateError) throw new Error("refund_attempt_persistence_failed")
    }

    const { error: reverseError } = await admin.rpc("reverse_flitt_ad_payment", { p_order_id: orderId })
    if (reverseError) throw new Error("refund_reconciliation_failed")

    const { error: refundUpdateError } = await admin
      .from("ad_orders")
      .update({
        refund_status: "succeeded",
        refund_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (refundUpdateError) throw new Error("refund_status_persistence_failed")
  } catch (error) {
    console.error("[admin ads] rejection refund failed", {
      adId,
      orderId,
      message: error instanceof Error ? error.message : "unknown_error",
    })
    await admin
      .from("ad_orders")
      .update({
        refund_status: "failed",
        refund_error: "provider_or_reconciliation_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
    revalidateAdSurfaces()
    adminAdsRedirect("reject_refund_failed", adId)
  }

  revalidateAdSurfaces()
  adminAdsRedirect("rejected_refunded")
}

export async function stopAdminAdAction(formData: FormData) {
  await requireAdminUser("/dashboard")
  const adId = readText(formData, "adId")
  if (!isAdId(adId)) adminAdsRedirect("invalid_id")

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("ads")
    .update({ is_active: false })
    .eq("id", adId)
    .select("id, submitted_by")
    .maybeSingle()

  if (error || !data) adminAdsRedirect("not_found")

  if (data.submitted_by) {
    await admin
      .from("ad_orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("ad_id", adId)
      .in("status", ["paid_pending_review", "scheduled", "active"])
  }

  revalidateAdSurfaces()
  adminAdsRedirect("stopped")
}
