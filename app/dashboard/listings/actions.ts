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

export type ListingBuyerCandidate = {
  id: string
  label: string
  username: string | null
  fullName: string | null
}

export type ListingBuyerCandidatesResult =
  | { ok: true; candidates: ListingBuyerCandidate[] }
  | {
      ok: false
      code: "unauthorized" | "invalid" | "not_found" | "server_error"
      message: string
    }

export type UpdateListingStatusInput = {
  listingId: string
  nextStatus: string
  expectedUpdatedAt: string
  soldToUserId?: string | null
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
      return "განცხადება გაყიდულად მოინიშნა. არჩეულ მყიდველს შეფასების დატოვება შეეძლება."
    case "archived":
      return "განცხადება არქივში გადავიდა."
    default:
      return "სტატუსი განახლდა."
  }
}

function buyerLabel(profile: { full_name: string | null; username: string | null }, index: number) {
  const fullName = profile.full_name?.trim()
  if (fullName) return fullName
  const username = profile.username?.trim()
  if (username) return `@${username}`
  return `მყიდველი ${index + 1}`
}

export async function getListingBuyerCandidatesAction(
  listingIdInput: string,
): Promise<ListingBuyerCandidatesResult> {
  const listingId = String(listingIdInput ?? "")
  if (!isUuid(listingId)) {
    return { ok: false, code: "invalid", message: "განცხადების იდენტიფიკატორი არასწორია." }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, code: "unauthorized", message: "სესია დასრულდა. თავიდან შედი ანგარიშში." }
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .maybeSingle()

  if (listingError) {
    console.error("listing_buyer_candidates_listing_failed", listingError.message)
    return { ok: false, code: "server_error", message: "მყიდველების სიის ჩატვირთვა ვერ მოხერხდა." }
  }
  if (!listing) {
    return { ok: false, code: "not_found", message: "განცხადება ვერ მოიძებნა ან მისი მართვის უფლება არ გაქვს." }
  }

  const { data: chats, error: chatsError } = await supabase
    .from("chats")
    .select("id, buyer_id")
    .eq("listing_id", listingId)
    .eq("seller_id", user.id)

  if (chatsError) {
    console.error("listing_buyer_candidates_chats_failed", chatsError.message)
    return { ok: false, code: "server_error", message: "მყიდველების სიის ჩატვირთვა ვერ მოხერხდა." }
  }
  if (!chats?.length) return { ok: true, candidates: [] }

  const chatIds = chats.map((chat) => chat.id)
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("chat_id, sender_id")
    .in("chat_id", chatIds)

  if (messagesError) {
    console.error("listing_buyer_candidates_messages_failed", messagesError.message)
    return { ok: false, code: "server_error", message: "მყიდველების სიის ჩატვირთვა ვერ მოხერხდა." }
  }

  const buyerByChat = new Map(chats.map((chat) => [chat.id, chat.buyer_id]))
  const eligibleBuyerIds = Array.from(
    new Set(
      (messages ?? [])
        .filter((message) => buyerByChat.get(message.chat_id) === message.sender_id)
        .map((message) => message.sender_id)
        .filter((id): id is string => typeof id === "string" && isUuid(id)),
    ),
  )

  if (eligibleBuyerIds.length === 0) return { ok: true, candidates: [] }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, full_name, is_suspended")
    .in("id", eligibleBuyerIds)
    .eq("is_suspended", false)

  if (profilesError) {
    console.error("listing_buyer_candidates_profiles_failed", profilesError.message)
    return { ok: false, code: "server_error", message: "მყიდველების სიის ჩატვირთვა ვერ მოხერხდა." }
  }

  const candidates = (profiles ?? [])
    .map((profile, index) => ({
      id: profile.id,
      label: buyerLabel(profile, index),
      username: profile.username ?? null,
      fullName: profile.full_name ?? null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ka"))

  return { ok: true, candidates }
}

async function validateSelectedBuyer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  sellerId: string,
  buyerId: string,
) {
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id")
    .eq("listing_id", listingId)
    .eq("seller_id", sellerId)
    .eq("buyer_id", buyerId)
    .maybeSingle()

  if (chatError || !chat) return false

  const [{ data: buyerProfile, error: buyerProfileError }, { data: buyerMessage, error: messageError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .eq("id", buyerId)
        .eq("is_suspended", false)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id")
        .eq("chat_id", chat.id)
        .eq("sender_id", buyerId)
        .limit(1)
        .maybeSingle(),
    ])

  return !buyerProfileError && !messageError && Boolean(buyerProfile && buyerMessage)
}

export async function updateListingStatusAction(
  input: UpdateListingStatusInput
): Promise<UpdateListingStatusResult> {
  const listingId = String(input?.listingId ?? "")
  const nextStatus = String(input?.nextStatus ?? "")
  const expectedUpdatedAt = String(input?.expectedUpdatedAt ?? "")
  const soldToUserId = input?.soldToUserId ? String(input.soldToUserId) : null

  if (
    !isUuid(listingId) ||
    !isListingStatus(nextStatus) ||
    !expectedUpdatedAt ||
    Number.isNaN(new Date(expectedUpdatedAt).getTime()) ||
    (nextStatus === "sold" && (!soldToUserId || !isUuid(soldToUserId)))
  ) {
    return {
      ok: false,
      code: "invalid",
      message:
        nextStatus === "sold"
          ? "გაყიდულად მონიშვნამდე აირჩიე მყიდველი."
          : "სტატუსის მოთხოვნა არასწორია. განაახლე გვერდი და სცადე ხელახლა.",
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

  if (nextStatus === "sold") {
    const buyerIsValid = await validateSelectedBuyer(supabase, listingId, user.id, soldToUserId!)
    if (!buyerIsValid) {
      return {
        ok: false,
        code: "invalid",
        message: "არჩეული მყიდველი ამ განცხადების მიმოწერაში ვერ დადასტურდა. განაახლე გვერდი და სცადე ხელახლა.",
      }
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
      sold_to_user_id: nextStatus === "sold" ? soldToUserId : null,
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
    if (
      updateError.message.includes("sold_buyer_required") ||
      updateError.message.includes("invalid_sold_buyer")
    ) {
      return {
        ok: false,
        code: "invalid",
        message: "მყიდველი ვერ დადასტურდა. აირჩიე ადამიანი, რომელმაც ამ ნივთზე მოგწერა.",
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
