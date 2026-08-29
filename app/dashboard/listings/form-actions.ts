"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { enforceRateLimit } from "@/lib/rate-limit"
import {
  detectListingImageMimeType,
  EDITABLE_LISTING_STATUSES,
  imageExtensionForMimeType,
  isListingImageMimeType,
  isUuid,
  type ListingFieldErrors,
  type ListingFormInput,
  type ListingImageMimeType,
  validateListingInput,
} from "@/lib/listing-form"
import {
  generateUniqueListingSlug,
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_LISTING_IMAGES,
} from "@/lib/listings"

const LISTING_IMAGES_BUCKET = "listing-images"

type ListingMode = "create" | "edit"

export type ListingUploadRequest = {
  clientId: string
  mimeType: string
  size: number
}

export type ListingUploadPlan = {
  clientId: string
  path: string
  token: string
}

export type PrepareListingUploadsInput = {
  mode: ListingMode
  listingId?: string
  files: ListingUploadRequest[]
}

export type PrepareListingUploadsResult =
  | { ok: true; listingId: string; plans: ListingUploadPlan[] }
  | { ok: false; code: "unauthorized" | "not_found" | "invalid" | "server_error"; message: string }

export type ListingImageOrderItem =
  | { kind: "existing"; id: string }
  | { kind: "uploaded"; path: string }

export type SaveListingInput = {
  mode: ListingMode
  listingId: string
  form: ListingFormInput
  images: ListingImageOrderItem[]
}

export type SaveListingResult =
  | { ok: true; listingId: string; slug: string; status: string; cleanupWarning: boolean }
  | {
      ok: false
      code: "unauthorized" | "not_found" | "invalid" | "rate_limited" | "server_error"
      message: string
      fieldErrors?: ListingFieldErrors
    }

type OwnedListing = {
  id: string
  seller_id: string
  category_id: number
  brand_id: string | null
  size_id: string | null
  title: string
  slug: string
  description: string
  price: number | string
  condition: string
  sale_type: string
  gender: string
  color: string | null
  material: string | null
  city: string | null
  status: string
  published_at: string | null
  cover_image_url: string | null
}

type ExistingImageRow = {
  id: string
  listing_id: string
  image_url: string
  sort_order: number
}

function safeServerError(message: string) {
  if (message.includes("rate") || message.includes("ბევრი მოთხოვნა")) {
    return "ძალიან ბევრი მოთხოვნაა. ცოტა ხანში სცადე ხელახლა."
  }
  return "ოპერაცია ვერ შესრულდა. მონაცემები შენარჩუნებულია — სცადე ხელახლა."
}

function imageMimeFromPath(path: string): ListingImageMimeType | null {
  if (path.endsWith(".jpg")) return "image/jpeg"
  if (path.endsWith(".png")) return "image/png"
  if (path.endsWith(".webp")) return "image/webp"
  return null
}

function isServerOwnedImagePath(path: string, userId: string, listingId: string) {
  const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const escapedListingId = listingId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(
    `^${escapedUserId}/${escapedListingId}/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`,
    "i"
  ).test(path)
}

async function getAuthenticatedContext() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return { supabase, user }
}

async function getOwnedListing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  listingId: string
) {
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, seller_id, category_id, brand_id, size_id, title, slug, description, price, condition, sale_type, gender, color, material, city, status, published_at, cover_image_url"
    )
    .eq("id", listingId)
    .eq("seller_id", userId)
    .maybeSingle()

  if (error) throw error
  return (data as OwnedListing | null) ?? null
}

async function validateLookupValues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: number,
  brandId: string | null,
  sizeId: string | null,
  allowedInactiveBrandId?: string | null
) {
  const [categoryResult, brandResult, sizeResult] = await Promise.all([
    supabase.from("categories").select("id").eq("id", categoryId).maybeSingle(),
    brandId
      ? supabase.from("brands").select("id, is_active").eq("id", brandId).maybeSingle()
      : Promise.resolve({ data: { id: null, is_active: true }, error: null }),
    sizeId
      ? supabase.from("sizes").select("id").eq("id", sizeId).maybeSingle()
      : Promise.resolve({ data: { id: null }, error: null }),
  ])

  if (categoryResult.error || brandResult.error || sizeResult.error) {
    throw categoryResult.error ?? brandResult.error ?? sizeResult.error
  }

  const fieldErrors: ListingFieldErrors = {}
  if (!categoryResult.data) fieldErrors.categoryId = "არჩეული კატეგორია აღარ არის ხელმისაწვდომი."
  if (
    brandId &&
    (!brandResult.data ||
      (!brandResult.data.is_active && brandId !== allowedInactiveBrandId))
  ) {
    fieldErrors.brandId = "არჩეული ბრენდი აღარ არის ხელმისაწვდომი."
  }
  if (sizeId && !sizeResult.data) fieldErrors.sizeId = "არჩეული ზომა აღარ არის ხელმისაწვდომი."
  return fieldErrors
}

async function removeUploadedPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[]
) {
  if (paths.length === 0) return false
  const { error } = await supabase.storage.from(LISTING_IMAGES_BUCKET).remove(paths)
  if (error) {
    console.error("Listing upload cleanup failed.", { fileCount: paths.length })
    return true
  }
  return false
}

async function validateUploadedPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
  userId: string,
  listingId: string
) {
  for (const path of paths) {
    if (!isServerOwnedImagePath(path, userId, listingId)) {
      return "სურათის upload path არასწორია."
    }

    const expectedMime = imageMimeFromPath(path)
    if (!expectedMime) return "სურათის ფორმატი არასწორია."

    const { data, error } = await supabase.storage.from(LISTING_IMAGES_BUCKET).download(path)
    if (error || !data) return "ატვირთული სურათის შემოწმება ვერ მოხერხდა."
    if (data.size === 0 || data.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      return "ატვირთული სურათის ზომა დაშვებულ ზღვარს სცდება."
    }

    const bytes = new Uint8Array(await data.arrayBuffer())
    const detectedMime = detectListingImageMimeType(bytes)
    if (!detectedMime || detectedMime !== expectedMime) {
      return "ატვირთული ფაილის რეალური ფორმატი დაშვებული არ არის."
    }
  }

  return null
}

function publicUrlForPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string
) {
  return supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function prepareListingUploadsAction(
  input: PrepareListingUploadsInput
): Promise<PrepareListingUploadsResult> {
  const context = await getAuthenticatedContext()
  if (!context) {
    return { ok: false, code: "unauthorized", message: "სურათების ატვირთვამდე შედი ანგარიშში." }
  }

  const { supabase, user } = context
  const mode = input?.mode
  const files = Array.isArray(input?.files) ? input.files : []

  if (mode !== "create" && mode !== "edit") {
    return { ok: false, code: "invalid", message: "ფორმის რეჟიმი არასწორია." }
  }

  if (files.length > MAX_LISTING_IMAGES) {
    return { ok: false, code: "invalid", message: `მაქსიმუმ ${MAX_LISTING_IMAGES} სურათის ატვირთვაა შესაძლებელი.` }
  }

  for (const file of files) {
    if (
      typeof file.clientId !== "string" ||
      file.clientId.length > 80 ||
      !isListingImageMimeType(file.mimeType) ||
      !Number.isSafeInteger(file.size) ||
      file.size <= 0 ||
      file.size > MAX_IMAGE_FILE_SIZE_BYTES
    ) {
      return { ok: false, code: "invalid", message: "ერთ-ერთი სურათის ტიპი ან ზომა არასწორია." }
    }
  }

  const listingId = mode === "create" ? crypto.randomUUID() : String(input.listingId ?? "")
  if (!isUuid(listingId)) {
    return { ok: false, code: "invalid", message: "განცხადების იდენტიფიკატორი არასწორია." }
  }

  try {
    if (mode === "edit") {
      const listing = await getOwnedListing(supabase, user.id, listingId)
      if (!listing) {
        return { ok: false, code: "not_found", message: "განცხადება ვერ მოიძებნა ან მისი შეცვლის უფლება არ გაქვს." }
      }
    }

    if (files.length === 0) {
      return { ok: true, listingId, plans: [] }
    }

    await enforceRateLimit(supabase, "listing_upload")

    const plans: ListingUploadPlan[] = []
    for (const file of files) {
      const extension = imageExtensionForMimeType(file.mimeType as ListingImageMimeType)
      const path = `${user.id}/${listingId}/${crypto.randomUUID()}.${extension}`
      const { data, error } = await supabase.storage
        .from(LISTING_IMAGES_BUCKET)
        .createSignedUploadUrl(path)

      if (error || !data?.token) throw error ?? new Error("Signed upload token is missing.")
      plans.push({ clientId: file.clientId, path, token: data.token })
    }

    return { ok: true, listingId, plans }
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    return { ok: false, code: "server_error", message: safeServerError(message) }
  }
}

export async function abortListingUploadsAction(listingId: string, paths: string[]) {
  const context = await getAuthenticatedContext()
  if (!context || !isUuid(listingId) || !Array.isArray(paths)) return

  const ownedPaths = [...new Set(paths)].filter((path) =>
    typeof path === "string" && isServerOwnedImagePath(path, context.user.id, listingId)
  )
  await removeUploadedPaths(context.supabase, ownedPaths)
}

export async function saveListingAction(input: SaveListingInput): Promise<SaveListingResult> {
  const context = await getAuthenticatedContext()
  if (!context) {
    return { ok: false, code: "unauthorized", message: "განცხადების შესანახად შედი ანგარიშში." }
  }

  const { supabase, user } = context
  if ((input?.mode !== "create" && input?.mode !== "edit") || !isUuid(input?.listingId ?? "")) {
    return { ok: false, code: "invalid", message: "მოთხოვნის მონაცემები არასწორია." }
  }

  const validation = validateListingInput(input.form)
  if (!validation.ok) {
    return {
      ok: false,
      code: "invalid",
      message: "შეამოწმე მონიშნული ველები.",
      fieldErrors: validation.fieldErrors,
    }
  }

  const imageOrder = Array.isArray(input.images) ? input.images : []
  if (imageOrder.length > MAX_LISTING_IMAGES) {
    return {
      ok: false,
      code: "invalid",
      message: `მაქსიმუმ ${MAX_LISTING_IMAGES} სურათის დამატებაა შესაძლებელი.`,
      fieldErrors: { images: `დატოვე მაქსიმუმ ${MAX_LISTING_IMAGES} სურათი.` },
    }
  }

  const existingIds = imageOrder
    .filter((item): item is Extract<ListingImageOrderItem, { kind: "existing" }> => item?.kind === "existing")
    .map((item) => item.id)
  const uploadedPaths = imageOrder
    .filter((item): item is Extract<ListingImageOrderItem, { kind: "uploaded" }> => item?.kind === "uploaded")
    .map((item) => item.path)

  if (
    imageOrder.some(
      (item) =>
        !item ||
        (item.kind !== "existing" && item.kind !== "uploaded") ||
        (item.kind === "existing" && typeof item.id !== "string") ||
        (item.kind === "uploaded" && typeof item.path !== "string")
    ) ||
    new Set(existingIds).size !== existingIds.length ||
    new Set(uploadedPaths).size !== uploadedPaths.length ||
    existingIds.some((id) => !isUuid(id))
  ) {
    return { ok: false, code: "invalid", message: "სურათების თანმიმდევრობა არასწორია." }
  }

  let ownedListing: OwnedListing | null = null
  let originalImages: ExistingImageRow[] = []
  let insertedListing = false
  let generatedImageIds: string[] = []

  try {
    if (input.mode === "edit") {
      ownedListing = await getOwnedListing(supabase, user.id, input.listingId)
      if (!ownedListing) {
        await removeUploadedPaths(supabase, uploadedPaths)
        return { ok: false, code: "not_found", message: "განცხადება ვერ მოიძებნა ან მისი შეცვლის უფლება არ გაქვს." }
      }
    } else {
      await enforceRateLimit(supabase, "listing_create")
    }

    const lookupErrors = await validateLookupValues(
      supabase,
      validation.data.categoryId,
      validation.data.brandId,
      validation.data.sizeId,
      ownedListing?.brand_id
    )
    if (Object.keys(lookupErrors).length > 0) {
      await removeUploadedPaths(supabase, uploadedPaths)
      return {
        ok: false,
        code: "invalid",
        message: "შეამოწმე არჩეული პარამეტრები.",
        fieldErrors: lookupErrors,
      }
    }

    if (input.mode === "create" && existingIds.length > 0) {
      await removeUploadedPaths(supabase, uploadedPaths)
      return { ok: false, code: "invalid", message: "ახალ განცხადებას ძველი სურათები ვერ მიებმება." }
    }

    if (input.mode === "edit") {
      const { data, error } = await supabase
        .from("listing_images")
        .select("id, listing_id, image_url, sort_order")
        .eq("listing_id", input.listingId)
        .order("sort_order", { ascending: true })
      if (error) throw error
      originalImages = (data as ExistingImageRow[] | null) ?? []

      const ownedImageIds = new Set(originalImages.map((image) => image.id))
      if (existingIds.some((id) => !ownedImageIds.has(id))) {
        await removeUploadedPaths(supabase, uploadedPaths)
        return { ok: false, code: "not_found", message: "ერთ-ერთი არსებული სურათი ვერ მოიძებნა." }
      }
    }

    const uploadValidationError = await validateUploadedPaths(
      supabase,
      uploadedPaths,
      user.id,
      input.listingId
    )
    if (uploadValidationError) {
      await removeUploadedPaths(supabase, uploadedPaths)
      return {
        ok: false,
        code: "invalid",
        message: uploadValidationError,
        fieldErrors: { images: uploadValidationError },
      }
    }

    const data = validation.data
    const { data: updatedProfile, error: phoneUpdateError } = await supabase
      .from("profiles")
      .update({ store_phone: data.sellerPhone })
      .eq("id", user.id)
      .select("id")
      .maybeSingle()
    if (phoneUpdateError || !updatedProfile) {
      throw phoneUpdateError ?? new Error("Seller profile is missing.")
    }

    const slug = await generateUniqueListingSlug(
      supabase,
      data.title,
      input.mode === "edit" ? input.listingId : undefined
    )
    const requestedStatus = data.publishNow ? "active" : "draft"
    const status =
      ownedListing && !EDITABLE_LISTING_STATUSES.includes(ownedListing.status as "draft" | "active")
        ? ownedListing.status
        : requestedStatus
    const publishedAt =
      status === "active"
        ? ownedListing?.published_at ?? new Date().toISOString()
        : status === "draft"
          ? null
          : ownedListing?.published_at ?? null

    const existingById = new Map(originalImages.map((image) => [image.id, image]))
    generatedImageIds = uploadedPaths.map(() => crypto.randomUUID())
    let uploadedIndex = 0
    const nextImageRows = imageOrder.map((item, sortOrder) => {
      if (item.kind === "existing") {
        const existing = existingById.get(item.id)
        if (!existing) throw new Error("Existing listing image is missing.")
        return { ...existing, sort_order: sortOrder }
      }

      const id = generatedImageIds[uploadedIndex]
      uploadedIndex += 1
      return {
        id,
        listing_id: input.listingId,
        image_url: publicUrlForPath(supabase, item.path),
        sort_order: sortOrder,
      }
    })

    const coverImageUrl = nextImageRows[0]?.image_url ?? null
    const listingPayload = {
      category_id: data.categoryId,
      brand_id: data.brandId,
      size_id: data.sizeId,
      title: data.title,
      slug,
      description: data.description,
      price: data.price,
      currency: "GEL",
      condition: data.condition,
      sale_type: data.saleType,
      gender: data.gender,
      color: data.color,
      material: data.material,
      city: data.city,
      status,
      published_at: publishedAt,
      cover_image_url: coverImageUrl,
    }

    if (input.mode === "create") {
      const { error } = await supabase.from("listings").insert({
        id: input.listingId,
        seller_id: user.id,
        ...listingPayload,
      })
      if (error) throw error
      insertedListing = true

      if (nextImageRows.length > 0) {
        const { error: imagesError } = await supabase.from("listing_images").insert(nextImageRows)
        if (imagesError) throw imagesError
      }
    } else {
      const { data: updated, error } = await supabase
        .from("listings")
        .update(listingPayload)
        .eq("id", input.listingId)
        .eq("seller_id", user.id)
        .select("id")
        .maybeSingle()
      if (error) throw error
      if (!updated) {
        await removeUploadedPaths(supabase, uploadedPaths)
        return { ok: false, code: "not_found", message: "განცხადება ვერ მოიძებნა ან მისი შეცვლის უფლება არ გაქვს." }
      }

      if (nextImageRows.length > 0) {
        const { error: upsertError } = await supabase
          .from("listing_images")
          .upsert(nextImageRows, { onConflict: "id" })
        if (upsertError) throw upsertError
      }

      const nextIds = new Set(nextImageRows.map((image) => image.id))
      const removedIds = originalImages.filter((image) => !nextIds.has(image.id)).map((image) => image.id)
      if (removedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("listing_images")
          .delete()
          .eq("listing_id", input.listingId)
          .in("id", removedIds)
        if (deleteError) throw deleteError
      }
    }

    const removedStoragePaths =
      input.mode === "edit"
        ? originalImages
            .filter((image) => !existingIds.includes(image.id))
            .map((image) => {
              const marker = `/storage/v1/object/public/${LISTING_IMAGES_BUCKET}/`
              const markerIndex = image.image_url.indexOf(marker)
              return markerIndex === -1
                ? null
                : decodeURIComponent(image.image_url.slice(markerIndex + marker.length))
            })
            .filter(
              (path): path is string =>
                Boolean(path) && isServerOwnedImagePath(path!, user.id, input.listingId)
            )
        : []
    const cleanupWarning = await removeUploadedPaths(supabase, removedStoragePaths)

    revalidatePath("/")
    revalidatePath("/catalog")
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/listings")
    if (ownedListing?.slug && ownedListing.slug !== slug) revalidatePath(`/listing/${ownedListing.slug}`)
    revalidatePath(`/listing/${slug}`)

    return { ok: true, listingId: input.listingId, slug, status, cleanupWarning }
  } catch (error) {
    if (insertedListing) {
      const { error: rollbackError } = await supabase
        .from("listings")
        .delete()
        .eq("id", input.listingId)
        .eq("seller_id", user.id)
      if (rollbackError) console.error("Listing create rollback failed.", { listingId: input.listingId })
    } else if (ownedListing) {
      const originalPayload = {
        category_id: ownedListing.category_id,
        brand_id: ownedListing.brand_id,
        size_id: ownedListing.size_id,
        title: ownedListing.title,
        slug: ownedListing.slug,
        description: ownedListing.description,
        price: ownedListing.price,
        condition: ownedListing.condition,
        sale_type: ownedListing.sale_type,
        gender: ownedListing.gender,
        color: ownedListing.color,
        material: ownedListing.material,
        city: ownedListing.city,
        status: ownedListing.status,
        published_at: ownedListing.published_at,
        cover_image_url: ownedListing.cover_image_url,
      }
      const { error: listingRollbackError } = await supabase
        .from("listings")
        .update(originalPayload)
        .eq("id", input.listingId)
        .eq("seller_id", user.id)

      if (generatedImageIds.length > 0) {
        await supabase
          .from("listing_images")
          .delete()
          .eq("listing_id", input.listingId)
          .in("id", generatedImageIds)
      }
      if (originalImages.length > 0) {
        await supabase.from("listing_images").upsert(originalImages, { onConflict: "id" })
      }
      if (listingRollbackError) {
        console.error("Listing edit rollback failed.", { listingId: input.listingId })
      }
    }

    await removeUploadedPaths(supabase, uploadedPaths)
    const message = error instanceof Error ? error.message : ""
    return {
      ok: false,
      code: message.includes("ბევრი მოთხოვნა") ? "rate_limited" : "server_error",
      message: safeServerError(message),
    }
  }
}
