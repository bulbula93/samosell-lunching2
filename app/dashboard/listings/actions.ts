"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { extractStoragePathFromPublicUrl, humanizeSupabaseError } from "@/lib/listings"
import { isUuid } from "@/lib/listing-form"
import {
  canTransitionListingStatus,
  isListingStatus,
  parseMyListingsFilter,
  type ListingStatus,
} from "@/lib/my-listings"
import { enforceRateLimit } from "@/lib/rate-limit"
import { isValidSellerPhone } from "@/lib/phone"

function buildRedirect(filter: string, result: string) {
  const search = new URLSearchParams()
  const safeFilter = parseMyListingsFilter(filter)
  if (safeFilter !== "all") search.set("status", safeFilter)
  search.set("flash", result)
  return `/dashboard/listings?${search.toString()}`
}

export type UpdateListingStatusInput = {
  listingId: string
  nextStatus: string
  expectedUpdatedAt: string
}

export type UpdateListingStatusResult =
  | {
      ok: true
      status: ListingStatus
      updatedAt: string
      message: string
    }
  | {
      ok: false
      code:
        | "unauthorized"
        | "invalid"
        | "not_found"
        | "conflict"
        | "rate_limited"
        | "server_error"
      message: string
    }

function statusSuccessMessage(status: ListingStatus) {
  switch (status) {
    case "active":
      return "განცხადება გამოქვეყნდა."
    case "draft":
      return "განცხადება დრაფტში დაბრუნდა."
    case "reserved":
      return "განცხადება დაჯავშნილად მოინიშნა."
    case "sold":
      return "განცხადება გაყიდულად მოინიშნა."
    case "archived":
      return "განცხადება არქივში გადავიდა."
    default:
      return "სტატუსი განახლდა."
  }
}

export async function updateListingStatusAction(
  input: UpdateListingStatusInput
): Promise<UpdateListingStatusResult> {
  const listingId = String(input?.listingId ?? "")
  const nextStatus = String(input?.nextStatus ?? "")
  const expectedUpdatedAt = String(input?.expectedUpdatedAt ?? "")

  if (
    !isUuid(listingId) ||
    !isListingStatus(nextStatus) ||
    !expectedUpdatedAt ||
    Number.isNaN(new Date(expectedUpdatedAt).getTime())
  ) {
    return {
      ok: false,
      code: "invalid",
      message: "სტატუსის მოთხოვნა არასწორია. განაახლე გვერდი და სცადე ხელახლა.",
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "სესია დასრულდა. თავიდან შედი ანგარიშში.",
    }
  }

  try {
    await enforceRateLimit(supabase, "listing_status_update")
  } catch {
    return {
      ok: false,
      code: "rate_limited",
      message: "ძალიან ბევრი ცვლილება გაიგზავნა. ცოტა ხანში სცადე ხელახლა.",
    }
  }

  const { data: ownedListing, error: lookupError } = await supabase
    .from("listings")
    .select("id, slug, status, updated_at, published_at")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .maybeSingle()

  if (lookupError) {
    console.error("listing_status_lookup_failed", lookupError.message)
    return {
      ok: false,
      code: "server_error",
      message: "სტატუსის შემოწმება ვერ მოხერხდა. სცადე ხელახლა.",
    }
  }

  if (!ownedListing) {
    return {
      ok: false,
      code: "not_found",
      message: "განცხადება ვერ მოიძებნა ან მისი შეცვლის უფლება არ გაქვს.",
    }
  }

  if (!isListingStatus(ownedListing.status)) {
    return {
      ok: false,
      code: "invalid",
      message: "ამ განცხადების სტატუსის მართვა ჯერ არ არის მხარდაჭერილი.",
    }
  }

  if (ownedListing.updated_at !== expectedUpdatedAt) {
    return {
      ok: false,
      code: "conflict",
      message: "განცხადება სხვა გვერდიდან შეიცვალა. განაახლე გვერდი და სცადე ხელახლა.",
    }
  }

  if (!canTransitionListingStatus(ownedListing.status, nextStatus)) {
    return {
      ok: false,
      code: "invalid",
      message: "ამ სტატუსზე გადასვლა დაუშვებელია.",
    }
  }

  if (nextStatus === "active") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("store_phone")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("listing_status_phone_lookup_failed", profileError.message)
      return { ok: false, code: "server_error", message: "ტელეფონის შემოწმება ვერ მოხერხდა. სცადე ხელახლა." }
    }
    if (!isValidSellerPhone(profile?.store_phone)) {
      return {
        ok: false,
        code: "invalid",
        message: "გამოქვეყნებამდე პროფილში შეავსე მოქმედი საკონტაქტო ტელეფონი.",
      }
    }
  }

  let publishedAt = ownedListing.published_at
  if (nextStatus === "active" && !publishedAt) publishedAt = new Date().toISOString()
  if (nextStatus === "draft") publishedAt = null

  const { data: updatedListing, error: updateError } = await supabase
    .from("listings")
    .update({
      status: nextStatus,
      published_at: publishedAt,
    })
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .eq("updated_at", ownedListing.updated_at)
    .select("status, updated_at")
    .maybeSingle()

  if (updateError) {
    if (updateError.message.includes("seller_phone_required")) {
      return {
        ok: false,
        code: "invalid",
        message: "გამოქვეყნებამდე პროფილში შეავსე მოქმედი საკონტაქტო ტელეფონი.",
      }
    }
    console.error("listing_status_update_failed", updateError.message)
    return {
      ok: false,
      code: "server_error",
      message: "სტატუსი ვერ განახლდა. მონაცემები არ შეცვლილა — სცადე ხელახლა.",
    }
  }

  if (!updatedListing || !isListingStatus(updatedListing.status)) {
    return {
      ok: false,
      code: "conflict",
      message: "განცხადება უკვე შეიცვალა. განაახლე გვერდი და სცადე ხელახლა.",
    }
  }

  revalidatePath("/")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/listings")
  revalidatePath("/catalog")
  if (ownedListing.slug) revalidatePath(`/listing/${ownedListing.slug}`)

  return {
    ok: true,
    status: updatedListing.status,
    updatedAt: updatedListing.updated_at,
    message: statusSuccessMessage(updatedListing.status),
  }
}


export async function deleteListingAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "")
  const filter = String(formData.get("filter") || "all")
  if (!listingId) redirect(buildRedirect(filter, "error"))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, slug, cover_image_url")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .maybeSingle()

  if (listingError) redirect(buildRedirect(filter, humanizeSupabaseError(listingError.message)))
  if (!listing) redirect(buildRedirect(filter, "error"))

  const { data: listingImages, error: imagesError } = await supabase
    .from("listing_images")
    .select("image_url")
    .eq("listing_id", listingId)

  if (imagesError) redirect(buildRedirect(filter, humanizeSupabaseError(imagesError.message)))

  const storagePaths = Array.from(
    new Set(
      [listing.cover_image_url, ...(listingImages ?? []).map((image) => image.image_url)]
        .filter((url): url is string => Boolean(url))
        .map((url) => extractStoragePathFromPublicUrl(url))
        .filter((path): path is string => Boolean(path))
    )
  )

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from("listing-images").remove(storagePaths)
    if (storageError) redirect(buildRedirect(filter, humanizeSupabaseError(storageError.message)))
  }

  const { error: deleteError } = await supabase.from("listings").delete().eq("id", listingId).eq("seller_id", user.id)
  if (deleteError) redirect(buildRedirect(filter, humanizeSupabaseError(deleteError.message)))

  revalidatePath("/dashboard/listings")
  revalidatePath("/catalog")
  if (listing.slug) revalidatePath(`/listing/${listing.slug}`)

  redirect(buildRedirect(filter, "deleted"))
}
