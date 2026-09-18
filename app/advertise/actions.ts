"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAuthenticatedUser } from "@/lib/auth"
import {
  AD_IMAGE_BUCKET,
  MAX_AD_IMAGE_FILE_SIZE_BYTES,
  validateAdminAdInput,
} from "@/lib/admin-ads"
import {
  detectListingImageMimeType,
  imageExtensionForMimeType,
  type ListingImageMimeType,
} from "@/lib/listing-form"
import { createAdminClient } from "@/lib/supabase/admin"

const ADVERTISE_PATH = "/advertise"
const SELF_SERVICE_PLACEMENTS = new Set(["home_hero_left", "home_hero_right"])

function withFlash(code: string) {
  const params = new URLSearchParams({ flash: code })
  return `${ADVERTISE_PATH}?${params.toString()}`
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
  const { user } = await requireAuthenticatedUser(ADVERTISE_PATH)

  const placementKey = String(formData.get("placementKey") ?? "").trim()
  if (!SELF_SERVICE_PLACEMENTS.has(placementKey)) {
    redirect(withFlash("invalid_placement"))
  }

  const validation = validateAdminAdInput({
    advertiserName: formData.get("advertiserName"),
    title: formData.get("title"),
    description: formData.get("description"),
    placementKey,
    targetUrl: formData.get("targetUrl"),
    priority: 0,
  })

  if (!validation.ok) redirect(withFlash(`invalid_${validation.code}`))

  const imageEntry = formData.get("image")
  const image = imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null
  const adId = randomUUID()
  const upload = image ? await uploadAdImage(image, adId) : null

  if (upload && !upload.ok) redirect(withFlash(upload.code))

  const admin = createAdminClient()
  const { error } = await admin.from("ads").insert({
    id: adId,
    placement_key: validation.data.placementKey,
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

  if (error) {
    if (upload?.ok) await admin.storage.from(AD_IMAGE_BUCKET).remove([upload.path])
    console.error("[advertise] self-service ad submission failed", { userId: user.id })
    redirect(withFlash("save_failed"))
  }

  revalidatePath("/admin/ads")
  revalidatePath(ADVERTISE_PATH)
  redirect(withFlash("submitted"))
}
