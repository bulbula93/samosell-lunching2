import { act, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import ChatWorkspace from "@/components/chat/ChatWorkspace"
import ChatThreadClient from "@/components/chat/ChatThreadClient"
import type { ChatThread } from "@/types/chat"
const mocks = vi.hoisted(() => ({ channel: vi.fn(), on: vi.fn(), subscribe: vi.fn(), removeChannel: vi.fn(), refresh: vi.fn(), markRead: vi.fn(), path: "/dashboard/chats" }))
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path, useRouter: () => ({ refresh: mocks.refresh }), useSearchParams: () => new URLSearchParams() }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks }))
vi.mock("@/app/dashboard/chats/actions", () => ({ markChatReadAction: mocks.markRead, sendChatMessageAction: vi.fn(), loadOlderMessagesAction: vi.fn() }))
const thread = { id: "chat-1", chat_type: "direct", buyer_id: "u", seller_id: "v", counterparty_id: "v", counterparty_full_name: "Seller", listing_title: null, last_message_body: null, created_at: "2026-10-01", sort_at: "2026-10-01", unread_count: 0 } as ChatThread
beforeEach(() => {
  vi.clearAllMocks()
  mocks.path = "/dashboard/chats"
  mocks.channel.mockReturnValue(mocks); mocks.on.mockReturnValue(mocks); mocks.subscribe.mockReturnValue(mocks)
  mocks.markRead.mockResolvedValue({ ok: true })
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 1 })
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
it("retains the inbox channel across chat navigation and refreshed threads while callbacks use the latest state", () => {
  const view = render(<ChatWorkspace currentUserId="u" initialThreads={[thread]}><div /></ChatWorkspace>)
  const callback = mocks.on.mock.calls[0][2]
  mocks.path = "/dashboard/chats/chat-2"
  const newer = { ...thread, id: "chat-2" }
  view.rerender(<ChatWorkspace currentUserId="u" initialThreads={[thread, newer]}><div /></ChatWorkspace>)
  expect(mocks.channel).toHaveBeenCalledOnce()
  act(() => callback({ new: { chat_id: "chat-2", sender_id: "v", body: "new message", created_at: "2026-10-06" } }))
  expect(screen.getByText("new message")).toBeInTheDocument()
  expect(mocks.refresh).not.toHaveBeenCalled()
  view.unmount()
  expect(mocks.removeChannel).toHaveBeenCalledOnce()
  callback({ new: { chat_id: "unknown", sender_id: "v", body: "late", created_at: "2026-10-06" } })
  expect(mocks.refresh).not.toHaveBeenCalled()
})
it("removes the inbox channel on recipient change and the thread channel on unmount", () => {
  const view = render(<ChatWorkspace currentUserId="u" initialThreads={[thread]}><div /></ChatWorkspace>)
  view.rerender(<ChatWorkspace currentUserId="v" initialThreads={[thread]}><div /></ChatWorkspace>)
  expect(mocks.removeChannel).toHaveBeenCalledOnce()
  view.unmount()
  expect(mocks.removeChannel).toHaveBeenCalledTimes(2)
  const detail = render(<ChatThreadClient chatId="chat-1" currentUserId="u" initialMessages={[]} otherPartyLabel="Seller" canSend initialHasMore={false} />)
  expect(mocks.on.mock.calls.at(-1)![1]).toMatchObject({ filter: "chat_id=eq.chat-1" })
  detail.unmount()
  expect(mocks.removeChannel).toHaveBeenCalledTimes(3)
})
