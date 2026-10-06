import React from "react"
import { writeFileSync } from "node:fs"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import ChatWorkspace from "@/components/chat/ChatWorkspace"
import ChatThreadPage from "@/app/dashboard/chats/[chatId]/page"
import type { ChatThread } from "@/types/chat"

const fixture = vi.hoisted(() => ({ thread: {} as ChatThread }))
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/chats", useRouter: () => ({ refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), notFound: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => {
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }
  return { channel: () => channel, removeChannel: vi.fn() }
} }))
vi.mock("@/lib/auth", () => ({ requireAuthenticatedUser: async () => ({ user: { id: "user" }, supabase: {
  rpc: async () => ({ error: null }),
  from: (table: string) => {
    const result = { data: table === "chat_threads" ? fixture.thread : table === "user_blocks" ? null : [], error: null }
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), maybeSingle: async () => result, limit: async () => result }
    return query
  },
} }) }))
vi.mock("@/lib/chat-story-context", () => ({ hydrateStoryContexts: vi.fn() }))
vi.mock("@/app/dashboard/chats/actions", () => ({ updateChatVisibilityAction: vi.fn() }))
vi.mock("@/components/chat/ChatThreadClient", () => ({ default: () => null }))
vi.mock("@/components/chat/ChatCommercePanel", () => ({ default: () => null }))
vi.mock("@/components/moderation/BlockUserForm", () => ({ default: () => null }))

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  fixture.thread = { id: "377f3329-6c04-4c40-8f33-873ab3ee4f76", chat_type: "support", buyer_id: "user", seller_id: "support", counterparty_id: "support", counterparty_full_name: "SamoSell Help", created_at: "2026-10-06", sort_at: "2026-10-06", unread_count: 0 } as ChatThread
})

it("renders the real brand asset in the inbox and open thread header", async () => {
  const header = await ChatThreadPage({ params: Promise.resolve({ chatId: fixture.thread.id }) })
  render(<ChatWorkspace currentUserId="user" initialThreads={[fixture.thread]}>{header}</ChatWorkspace>)
  const avatars = screen.getAllByRole("img", { name: "SamoSell-ის ლოგო" })
  expect(avatars).toHaveLength(2)
  expect(avatars[0]).toHaveClass("h-12", "w-12")
  expect(avatars[1]).toHaveClass("h-11", "w-11")
  avatars.forEach((avatar) => expect(avatar.querySelector("img")).toHaveAttribute("src", "/brand/samosell-header-logo.svg"))
  expect(screen.queryByText("SH")).not.toBeInTheDocument()
  expect(screen.getAllByText("✓ ოფიციალური")).toHaveLength(2)
  if (process.env.SUPPORT_AVATAR_QA_HTML_PATH) {
    writeFileSync(process.env.SUPPORT_AVATAR_QA_HTML_PATH, document.body.innerHTML)
  }
  avatars.forEach((avatar) => fireEvent.error(avatar.querySelector("img")!))
  avatars.forEach((avatar) => {
    expect(avatar.querySelector("img")).toBeNull()
    expect(avatar.querySelector("svg")).not.toBeNull()
    expect(avatar).toHaveTextContent("")
  })
})

it.each(["direct", "listing"] as const)("preserves ordinary %s avatar initials in both views", async (chat_type) => {
  fixture.thread = { ...fixture.thread, chat_type, counterparty_full_name: "Nino Seller" }
  const header = await ChatThreadPage({ params: Promise.resolve({ chatId: fixture.thread.id }) })
  render(<ChatWorkspace currentUserId="user" initialThreads={[fixture.thread]}>{header}</ChatWorkspace>)
  expect(screen.getAllByText("NS")).toHaveLength(2)
  expect(screen.queryByRole("img", { name: "SamoSell-ის ლოგო" })).not.toBeInTheDocument()
})

it("keeps the customer's own avatar on the support operator's inbox", () => {
  render(<ChatWorkspace currentUserId="support" initialThreads={[fixture.thread]}><div /></ChatWorkspace>)
  expect(screen.getByText("SH")).toBeInTheDocument()
  expect(screen.queryByRole("img", { name: "SamoSell-ის ლოგო" })).not.toBeInTheDocument()
})
