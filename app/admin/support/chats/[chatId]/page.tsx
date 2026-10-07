import Link from "next/link"
import { notFound } from "next/navigation"
import AdminSupportChatClient from "@/components/admin/AdminSupportChatClient"
import { requireAdminUser } from "@/lib/auth"
import { CHAT_MESSAGE_PAGE_SIZE, isChatUuid } from "@/lib/chats"
import type { ChatMessage } from "@/types/chat"

type SupportThread = {
  id: string
  buyer_id: string
  counterparty_username: string | null
  counterparty_full_name: string | null
  counterparty_city: string | null
  counterparty_avatar_url: string | null
}

export default async function AdminSupportChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  const { chatId } = await params
  if (!isChatUuid(chatId)) notFound()

  const { supabase } = await requireAdminUser("/admin/support/chats")

  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select(
      "id, buyer_id, counterparty_username, counterparty_full_name, counterparty_city, counterparty_avatar_url",
    )
    .eq("id", chatId)
    .eq("chat_type", "support")
    .maybeSingle()

  if (threadError || !thread) notFound()

  const { data: messageRows, error: messageError } = await supabase
    .from("messages")
    .select("id, chat_id, sender_id, body, created_at, message_type, story_id")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_MESSAGE_PAGE_SIZE + 1)

  if (messageError) {
    throw new Error("Support მიმოწერის შეტყობინებები ვერ ჩაიტვირთა.")
  }

  const hasMore = (messageRows?.length ?? 0) > CHAT_MESSAGE_PAGE_SIZE
  const initialMessages = ((messageRows ?? []) as ChatMessage[])
    .slice(0, CHAT_MESSAGE_PAGE_SIZE)
    .reverse()

  const typedThread = thread as SupportThread
  const customerLabel =
    typedThread.counterparty_full_name ||
    typedThread.counterparty_username ||
    "მომხმარებელი"

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-brand-soft text-sm font-black text-brand">
              {typedThread.counterparty_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={typedThread.counterparty_avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                customerLabel.slice(0, 1).toLocaleUpperCase("ka-GE")
              )}
            </div>
            <div className="min-w-0">
              <div className="ui-eyebrow">SamoSell Help / Live Chat</div>
              <h1 className="mt-1 truncate text-2xl font-black text-text">
                {customerLabel}
              </h1>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-soft">
                {typedThread.counterparty_username ? (
                  <span>@{typedThread.counterparty_username}</span>
                ) : null}
                {typedThread.counterparty_city ? <span>· {typedThread.counterparty_city}</span> : null}
                <span>· მომხმარებელი პასუხს SamoSell Help-ის სახელით მიიღებს</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {typedThread.counterparty_username ? (
              <Link
                href={`/seller/${encodeURIComponent(typedThread.counterparty_username)}`}
                className="ui-btn-secondary"
              >
                პროფილი
              </Link>
            ) : null}
            <Link href="/admin/support/chats" className="ui-btn-secondary">
              ← Inbox
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <AdminSupportChatClient
          chatId={typedThread.id}
          buyerId={typedThread.buyer_id}
          initialMessages={initialMessages}
          initialHasMore={hasMore}
        />
      </div>
    </main>
  )
}
