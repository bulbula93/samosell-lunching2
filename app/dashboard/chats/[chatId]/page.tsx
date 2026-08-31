import Link from "next/link"
import { notFound } from "next/navigation"
import { updateChatVisibilityAction } from "@/app/dashboard/chats/actions"
import ChatCommercePanel, { type ChatOfferSummary } from "@/components/chat/ChatCommercePanel"
import ChatThreadClient from "@/components/chat/ChatThreadClient"
import Avatar from "@/components/shared/Avatar"
import SmartImage from "@/components/shared/SmartImage"
import {
  CHAT_MESSAGE_PAGE_SIZE,
  canSendChatMessageForStatus,
  chatCounterpartyName,
  isChatUuid,
} from "@/lib/chats"
import { requireAuthenticatedUser } from "@/lib/auth"
import { formatPrice } from "@/lib/listings"
import type { ChatMessage, ChatThread } from "@/types/chat"

export default async function ChatThreadPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  if (!isChatUuid(chatId)) notFound()

  const { supabase, user } = await requireAuthenticatedUser(`/dashboard/chats/${chatId}`)

  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select(
      "id, listing_id, buyer_id, seller_id, created_at, last_message_at, buyer_last_read_at, seller_last_read_at, listing_slug, listing_title, price, currency, listing_status, cover_image_url, counterparty_id, counterparty_username, counterparty_full_name, counterparty_city, last_message_body, last_message_sender_id, last_message_created_at, unread_count, sort_at, is_archived, counterparty_avatar_url"
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

  const [messagesResult, listingStateResult, offersResult] = await Promise.all([
    supabase
      .from("messages")
      .select("id, chat_id, sender_id, body, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(CHAT_MESSAGE_PAGE_SIZE + 1),
    supabase
      .from("listings")
      .select("status, reserved_for_user_id, sold_to_user_id")
      .eq("id", typedThread.listing_id)
      .maybeSingle(),
    supabase
      .from("chat_offers")
      .select("id, amount, currency, status, created_at, responded_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  if (messagesResult.error) throw new Error("CHAT_MESSAGES_QUERY_FAILED", { cause: messagesResult.error })
  if (listingStateResult.error) throw new Error("CHAT_LISTING_STATE_QUERY_FAILED", { cause: listingStateResult.error })
  if (offersResult.error) throw new Error("CHAT_OFFERS_QUERY_FAILED", { cause: offersResult.error })

  const messageRows = (messagesResult.data ?? []) as ChatMessage[]
  const hasOlderMessages = messageRows.length > CHAT_MESSAGE_PAGE_SIZE
  const typedMessages = messageRows.slice(0, CHAT_MESSAGE_PAGE_SIZE).reverse()
  const otherPartyLabel = chatCounterpartyName(typedThread)
  const listingStatus = listingStateResult.data?.status ?? typedThread.listing_status
  const canSend = canSendChatMessageForStatus(listingStatus)
  const listingIsPublic = listingStatus === "active"
  const role = typedThread.buyer_id === user.id ? "buyer" : "seller"
  const offers: ChatOfferSummary[] = (offersResult.data ?? []).map((offer) => ({
    id: offer.id,
    amount: Number(offer.amount),
    currency: offer.currency,
    status: offer.status as ChatOfferSummary["status"],
    created_at: offer.created_at,
    responded_at: offer.responded_at,
  }))

  return (
    <main className="ui-container py-8 sm:py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="ui-eyebrow">შეტყობინებები</div>
          <h1 className="mt-3 break-words text-3xl font-black text-text sm:text-4xl">
            {typedThread.listing_title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-soft">
            <span>{formatPrice(typedThread.price, typedThread.currency)}</span>
            <span>·</span>
            <span>{otherPartyLabel}</span>
            {typedThread.counterparty_city ? (
              <>
                <span>·</span>
                <span>{typedThread.counterparty_city}</span>
              </>
            ) : null}
            <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold">
              {listingStatus}
            </span>
            {typedThread.is_archived ? (
              <span className="rounded-full bg-surface-alt px-3 py-1 text-xs font-bold">
                შენს არქივშია
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/chats" className="ui-btn-secondary">
            ყველა მიმოწერა
          </Link>
          {listingIsPublic ? (
            <Link href={`/listing/${typedThread.listing_slug}`} className="ui-btn-primary">
              განცხადების ნახვა
            </Link>
          ) : null}
          <form action={updateChatVisibilityAction}>
            <input type="hidden" name="chatId" value={typedThread.id} />
            <input type="hidden" name="intent" value={typedThread.is_archived ? "restore" : "archive"} />
            <input type="hidden" name="returnTo" value="thread" />
            <button className="ui-btn-secondary">
              {typedThread.is_archived ? "არქივიდან დაბრუნება" : "დამალვა"}
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <ChatThreadClient
          chatId={typedThread.id}
          currentUserId={user.id}
          initialMessages={typedMessages}
          otherPartyLabel={otherPartyLabel}
          canSend={canSend}
          initialHasMore={hasOlderMessages}
        />

        <aside className="space-y-4">
          <section aria-labelledby="counterparty-title" className="ui-card p-6">
            <div className="ui-eyebrow">მეორე მხარე</div>
            <div className="mt-4 flex items-center gap-3">
              <Avatar
                src={typedThread.counterparty_avatar_url}
                alt={otherPartyLabel}
                fallbackText={otherPartyLabel}
                sizeClassName="h-12 w-12"
              />
              <div className="min-w-0">
                <h2 id="counterparty-title" className="truncate text-xl font-black text-text">
                  {otherPartyLabel}
                </h2>
                <p className="mt-1 text-sm text-text-soft">
                  {role === "buyer" ? "გამყიდველი" : "მყიდველი"}
                </p>
              </div>
            </div>
            {typedThread.counterparty_city ? (
              <p className="mt-4 text-sm text-text-soft">
                მდებარეობა: {typedThread.counterparty_city}
              </p>
            ) : null}
            {typedThread.counterparty_username ? (
              <Link href={`/seller/${encodeURIComponent(typedThread.counterparty_username)}`} className="ui-btn-secondary mt-4 w-full">
                პროფილის ნახვა
              </Link>
            ) : null}
          </section>

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

          <section aria-labelledby="chat-listing-title" className="ui-card p-6">
            <div className="ui-eyebrow">განცხადების კონტექსტი</div>
            <div className="mt-3 flex gap-4">
              <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-alt">
                <SmartImage src={typedThread.cover_image_url} alt={typedThread.listing_title} wrapperClassName="h-full w-full" fallbackLabel="სურათი არ არის" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="chat-listing-title" className="break-words text-lg font-black text-text">
                  {typedThread.listing_title}
                </h2>
                <div className="mt-1 text-sm text-text-soft">
                  {formatPrice(typedThread.price, typedThread.currency)}
                </div>
                <p className="mt-4 text-sm leading-6 text-text-soft">
                  ისტორია ინახება განცხადების სტატუსის ცვლილების შემდეგაც.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}
