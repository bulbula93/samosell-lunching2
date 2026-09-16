import { hydrateStoryContexts } from "@/lib/chat-story-context"
import Link from "next/link"
import { notFound } from "next/navigation"
import { updateChatVisibilityAction } from "@/app/dashboard/chats/actions"
import ChatCommercePanel, { type ChatOfferSummary } from "@/components/chat/ChatCommercePanel"
import ChatThreadClient from "@/components/chat/ChatThreadClient"
import BlockUserForm from "@/components/moderation/BlockUserForm"
import Avatar from "@/components/shared/Avatar"
import SmartImage from "@/components/shared/SmartImage"
import {
  CHAT_MESSAGE_PAGE_SIZE,
  canSendChatMessageForStatus,
  chatCounterpartyName,
  isChatUuid,
} from "@/lib/chats"
import { requireAuthenticatedUser } from "@/lib/auth"
import { formatPrice, listingStatusLabel } from "@/lib/listings"
import type { ChatMessage, ChatThread } from "@/types/chat"

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  const { chatId } = await params
  if (!isChatUuid(chatId)) notFound()

  const { supabase, user } = await requireAuthenticatedUser(`/dashboard/chats/${chatId}`)

  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select(
      "id, chat_type, listing_id, buyer_id, seller_id, created_at, last_message_at, buyer_last_read_at, seller_last_read_at, listing_slug, listing_title, price, currency, listing_status, cover_image_url, counterparty_id, counterparty_username, counterparty_full_name, counterparty_city, last_message_body, last_message_sender_id, last_message_created_at, unread_count, sort_at, is_archived, counterparty_avatar_url",
    )
    .eq("id", chatId)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .maybeSingle()

  if (threadError) throw new Error("CHAT_THREAD_QUERY_FAILED", { cause: threadError })
  if (!thread) notFound()

  const typedThread = thread as ChatThread

  const { error: readError } = await supabase.rpc("mark_chat_read", {
    p_chat_id: chatId,
  })
  if (readError) {
    console.error("Chat read state update failed.", { chatId })
  }

  const [messagesResult, listingStateResult, offersResult, blockResult] = await Promise.all([
    supabase
      .from("messages")
      .select("id, chat_id, sender_id, body, created_at, message_type, story_id")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(CHAT_MESSAGE_PAGE_SIZE + 1),
    typedThread.listing_id
      ? supabase
          .from("listings")
          .select("status, reserved_for_user_id, sold_to_user_id")
          .eq("id", typedThread.listing_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    typedThread.chat_type === "listing"
      ? supabase
          .from("chat_offers")
          .select("id, amount, currency, status, created_at, responded_at")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", typedThread.counterparty_id)
      .maybeSingle(),
  ])

  if (messagesResult.error) throw new Error("CHAT_MESSAGES_QUERY_FAILED", { cause: messagesResult.error })
  if (listingStateResult.error) throw new Error("CHAT_LISTING_STATE_QUERY_FAILED", { cause: listingStateResult.error })
  if (offersResult.error) throw new Error("CHAT_OFFERS_QUERY_FAILED", { cause: offersResult.error })

  const messageRows = (messagesResult.data ?? []) as ChatMessage[]
  await hydrateStoryContexts(supabase, messageRows)
  const hasOlderMessages = messageRows.length > CHAT_MESSAGE_PAGE_SIZE
  const typedMessages = messageRows.slice(0, CHAT_MESSAGE_PAGE_SIZE).reverse()
  const otherPartyLabel = chatCounterpartyName(typedThread)
  const listingStatus = listingStateResult.data?.status ?? typedThread.listing_status
  const canSend =
    typedThread.chat_type === "direct" || canSendChatMessageForStatus(listingStatus)
  const listingIsPublic = listingStatus === "active"
  const role = typedThread.buyer_id === user.id ? "buyer" : "seller"
  const isBlocked = Boolean(blockResult.data)
  const offers: ChatOfferSummary[] = (offersResult.data ?? []).map((offer) => ({
    id: offer.id,
    amount: Number(offer.amount),
    currency: offer.currency,
    status: offer.status as ChatOfferSummary["status"],
    created_at: offer.created_at,
    responded_at: offer.responded_at,
  }))

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <header className="shrink-0 border-b border-line bg-white px-3 py-3 sm:px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/chats"
            aria-label="მიმოწერების სიაში დაბრუნება"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text transition hover:bg-surface-alt lg:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>

          <Avatar
            src={typedThread.counterparty_avatar_url}
            alt={otherPartyLabel}
            fallbackText={otherPartyLabel}
            sizeClassName="h-11 w-11"
            textClassName="text-sm"
          />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-black text-text sm:text-lg">
              {otherPartyLabel}
            </h1>
            <p className="mt-0.5 truncate text-xs text-text-soft">
              {typedThread.chat_type === "direct"
                ? "პირადი დიალოგი"
                : role === "buyer"
                  ? "გამყიდველი"
                  : "მყიდველი"}
              {typedThread.counterparty_city ? ` · ${typedThread.counterparty_city}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {typedThread.counterparty_username ? (
              <Link
                href={`/seller/${encodeURIComponent(typedThread.counterparty_username)}`}
                className="hidden rounded-full border border-line px-3 py-2 text-xs font-bold text-text transition hover:bg-surface-alt sm:inline-flex"
              >
                პროფილი
              </Link>
            ) : null}

            <form action={updateChatVisibilityAction}>
              <input type="hidden" name="chatId" value={typedThread.id} />
              <input
                type="hidden"
                name="intent"
                value={typedThread.is_archived ? "restore" : "archive"}
              />
              <input type="hidden" name="returnTo" value="thread" />
              <button
                type="submit"
                className="rounded-full border border-line px-3 py-2 text-xs font-bold text-text transition hover:bg-surface-alt"
              >
                {typedThread.is_archived ? "აღდგენა" : "არქივი"}
              </button>
            </form>

            {!blockResult.error ? (
              <div className="hidden sm:block">
                <BlockUserForm
                  blockedId={typedThread.counterparty_id}
                  nextPath={`/dashboard/chats/${typedThread.id}`}
                  isBlocked={isBlocked}
                />
              </div>
            ) : null}
          </div>
        </div>

        {typedThread.chat_type === "listing" ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface-alt px-3 py-2.5">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
              <SmartImage
                src={typedThread.cover_image_url}
                alt={typedThread.listing_title || "განცხადება"}
                wrapperClassName="h-full w-full"
                fallbackLabel="სურათი არ არის"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-text">
                {typedThread.listing_title || "განცხადება"}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-soft">
                {typedThread.price !== null && typedThread.currency ? (
                  <span className="font-bold text-text">
                    {formatPrice(typedThread.price, typedThread.currency)}
                  </span>
                ) : null}
                {listingStatus ? <span>· {listingStatusLabel(listingStatus)}</span> : null}
              </div>
            </div>
            {listingIsPublic && typedThread.listing_slug ? (
              <Link
                href={`/listing/${typedThread.listing_slug}`}
                className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-bold text-text ring-1 ring-inset ring-line transition hover:ring-brand/30"
              >
                ნივთი
              </Link>
            ) : null}
          </div>
        ) : null}

        {typedThread.chat_type === "listing" &&
        listingStatus &&
        typedThread.price !== null &&
        typedThread.currency ? (
          <details className="mt-2 rounded-xl border border-line bg-white">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-black text-text">
              შეთავაზება / გარიგების მართვა
            </summary>
            <div className="max-h-72 overflow-y-auto border-t border-line bg-surface-alt/40 p-3">
              <ChatCommercePanel
                chatId={typedThread.id}
                role={role}
                buyerId={typedThread.buyer_id}
                currentUserId={user.id}
                listingStatus={listingStatus}
                listingPrice={Number(typedThread.price)}
                currency={typedThread.currency}
                reservedForUserId={listingStateResult.data?.reserved_for_user_id ?? null}
                soldToUserId={listingStateResult.data?.sold_to_user_id ?? null}
                initialOffers={offers}
              />
            </div>
          </details>
        ) : null}
      </header>

      <div className="min-h-0 flex-1">
        <ChatThreadClient
          chatId={typedThread.id}
          currentUserId={user.id}
          initialMessages={typedMessages}
          otherPartyLabel={otherPartyLabel}
          canSend={canSend && !isBlocked}
          initialHasMore={hasOlderMessages}
        />
      </div>
    </div>
  )
}
