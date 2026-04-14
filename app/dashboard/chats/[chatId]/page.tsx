import Link from "next/link"
import { notFound } from "next/navigation"
import { updateChatVisibilityAction } from "@/app/dashboard/chats/actions"
import ChatThreadClient from "@/components/chat/ChatThreadClient"
import SmartImage from "@/components/shared/SmartImage"
import { chatCounterpartyName } from "@/lib/chats"
import { formatPrice } from "@/lib/listings"
import { createClient } from "@/lib/supabase/server"
import type { ChatMessage, ChatThread } from "@/types/chat"

export default async function ChatThreadPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: thread } = await supabase
    .from("chat_threads")
    .select(
      "id, listing_id, buyer_id, seller_id, created_at, last_message_at, buyer_last_read_at, seller_last_read_at, listing_slug, listing_title, price, currency, listing_status, cover_image_url, counterparty_id, counterparty_username, counterparty_full_name, counterparty_city, last_message_body, last_message_sender_id, last_message_created_at, unread_count, sort_at, is_archived"
    )
    .eq("id", chatId)
    .maybeSingle()

  if (!thread) notFound()

  const readField = thread.buyer_id === user.id ? "buyer_last_read_at" : "seller_last_read_at"
  await supabase.from("chats").update({ [readField]: new Date().toISOString() }).eq("id", chatId)

  const { data: messages } = await supabase
    .from("messages")
    .select("id, chat_id, sender_id, body, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })

  const typedThread = thread as ChatThread
  const typedMessages = (messages ?? []) as ChatMessage[]
  const otherPartyLabel = chatCounterpartyName(typedThread)

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">ჩათი</div>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">{typedThread.listing_title}</h1>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-neutral-600">
            <span>{formatPrice(typedThread.price, typedThread.currency)}</span>
            <span>·</span>
            <span>{otherPartyLabel}</span>
            {typedThread.counterparty_city ? <><span>·</span><span>{typedThread.counterparty_city}</span></> : null}
            {typedThread.is_archived ? <><span>·</span><span>არქივშია</span></> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/chats" className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">
            ყველა ჩათი
          </Link>
          <Link href={`/listing/${typedThread.listing_slug}`} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
            განცხადების ნახვა
          </Link>
          <form action={updateChatVisibilityAction}>
            <input type="hidden" name="chatId" value={typedThread.id} />
            <input type="hidden" name="intent" value={typedThread.is_archived ? "restore" : "archive"} />
            <input type="hidden" name="nextPath" value={typedThread.is_archived ? `/dashboard/chats/${typedThread.id}` : "/dashboard/chats"} />
            <button className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">
              {typedThread.is_archived ? "არქივიდან დაბრუნება" : "დამალვა"}
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <ChatThreadClient
          chatId={typedThread.id}
          currentUserId={user.id}
          readField={readField}
          initialMessages={typedMessages}
          otherPartyLabel={otherPartyLabel}
        />

        <aside className="space-y-4">
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">მეორე მხარე</div>
            <div className="mt-3 text-2xl font-black text-neutral-900">{otherPartyLabel}</div>
            <div className="mt-3 space-y-2 text-sm text-neutral-700">
              <div><span className="font-semibold">ქალაქი:</span> {typedThread.counterparty_city || "—"}</div>
              <div><span className="font-semibold">როლი:</span> {typedThread.buyer_id === user.id ? "გამყიდველი" : "მყიდველი"}</div>
              <div><span className="font-semibold">ბოლო აქტივობა:</span> {typedThread.last_message_created_at ? new Date(typedThread.last_message_created_at).toLocaleString("ka-GE") : "ჯერ არ არის"}</div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">განცხადება</div>
            <div className="mt-3 flex gap-4">
              <div className="h-28 w-24 overflow-hidden rounded-[1.25rem] bg-neutral-200">
                <SmartImage src={typedThread.cover_image_url} alt={typedThread.listing_title} wrapperClassName="h-full w-full" fallbackLabel="სურათი არ არის" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-black text-neutral-900">{typedThread.listing_title}</div>
                <div className="mt-1 text-sm text-neutral-600">{formatPrice(typedThread.price, typedThread.currency)}</div>
                <div className="mt-4 text-sm text-neutral-600">
                  ეს დიალოგი მიბმულია კონკრეტულად ამ განცხადებაზე. თუ ნივთის სტატუსს შეცვლი, ჩათი შენარჩუნდება.
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
