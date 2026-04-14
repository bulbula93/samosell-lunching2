"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAuthenticatedUser } from "@/lib/auth"
import { humanizeSupabaseError } from "@/lib/listings"
import { enforceRateLimit } from "@/lib/rate-limit"

function buildListingRedirect(slug: string, message?: string) {
  if (!message) return `/listing/${slug}`
  const search = new URLSearchParams({ chatError: message })
  return `/listing/${slug}?${search.toString()}`
}

export async function startChatAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "")
  const listingSlug = String(formData.get("listingSlug") || "")

  if (!listingId || !listingSlug) {
    redirect("/catalog")
  }

  const { supabase, user } = await requireAuthenticatedUser(`/listing/${listingSlug}`)

  try {
    await enforceRateLimit(supabase, "chat_start")
  } catch (error) {
    redirect(buildListingRedirect(listingSlug, humanizeSupabaseError(error instanceof Error ? error.message : "")))
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, slug, seller_id, status")
    .eq("id", listingId)
    .maybeSingle()

  if (listingError || !listing) {
    redirect(buildListingRedirect(listingSlug, "განცხადება ვერ მოიძებნა."))
  }

  if (listing.seller_id === user.id) {
    redirect(`/dashboard/listings`)
  }

  if (listing.status !== "active") {
    redirect(buildListingRedirect(listing.slug, "ჩატი მხოლოდ აქტიურ განცხადებაზე შეგიძლია დაიწყო."))
  }

  const [{ data: sellerProfile }, { data: myBlock }, { data: theirBlock }] = await Promise.all([
    supabase.from("profiles").select("is_suspended").eq("id", listing.seller_id).maybeSingle(),
    supabase.from("user_blocks").select("id").eq("blocker_id", user.id).eq("blocked_id", listing.seller_id).maybeSingle(),
    supabase.from("user_blocks").select("id").eq("blocker_id", listing.seller_id).eq("blocked_id", user.id).maybeSingle(),
  ])

  if (sellerProfile?.is_suspended) {
    redirect(buildListingRedirect(listing.slug, "ამ გამყიდველთან მიწერა დროებით შეზღუდულია."))
  }

  if (myBlock?.id || theirBlock?.id) {
    redirect(buildListingRedirect(listing.slug, "ჩატის დაწყება ვერ მოხერხდა, რადგან ერთ-ერთ მხარეს ბლოკი აქვს ჩართული."))
  }

  const { data: existingChat } = await supabase
    .from("chats")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("buyer_id", user.id)
    .eq("seller_id", listing.seller_id)
    .maybeSingle()

  if (existingChat?.id) {
    redirect(`/dashboard/chats/${existingChat.id}`)
  }

  const { data: insertedChat, error: insertError } = await supabase
    .from("chats")
    .insert({
      listing_id: listing.id,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      buyer_last_read_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (insertError || !insertedChat) {
    redirect(buildListingRedirect(listing.slug, humanizeSupabaseError(insertError?.message)))
  }

  redirect(`/dashboard/chats/${insertedChat.id}`)
}

export async function updateChatVisibilityAction(formData: FormData) {
  const chatId = String(formData.get("chatId") || "")
  const intent = String(formData.get("intent") || "")
  const nextPath = String(formData.get("nextPath") || "/dashboard/chats")

  if (!chatId || !intent) redirect(nextPath)

  const { supabase, user } = await requireAuthenticatedUser(nextPath)

  const { data: chat } = await supabase
    .from("chats")
    .select("id, buyer_id, seller_id")
    .eq("id", chatId)
    .maybeSingle()

  if (!chat) redirect("/dashboard/chats")

  const isBuyer = chat.buyer_id === user.id
  const isSeller = chat.seller_id === user.id
  if (!isBuyer && !isSeller) redirect("/dashboard/chats")

  const field = isBuyer ? "buyer_archived_at" : "seller_archived_at"
  const payload = intent === "archive" ? { [field]: new Date().toISOString() } : { [field]: null }

  const { error } = await supabase.from("chats").update(payload).eq("id", chatId)

  if (error) {
    redirect(`/dashboard/chats?flash=${encodeURIComponent(humanizeSupabaseError(error.message))}`)
  }

  revalidatePath("/dashboard/chats")
  revalidatePath(`/dashboard/chats/${chatId}`)
  redirect(nextPath)
}
