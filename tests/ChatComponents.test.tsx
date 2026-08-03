import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ChatThreadClient from "@/components/chat/ChatThreadClient"
import StartChatButton from "@/components/chat/StartChatButton"
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/chats"
import type { ChatMessage } from "@/types/chat"

const mocks = vi.hoisted(() => ({
  startChatAction: vi.fn(),
  sendChatMessageAction: vi.fn(),
  loadOlderMessagesAction: vi.fn(),
  markChatReadAction: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock("@/app/dashboard/chats/actions", () => ({
  startChatAction: mocks.startChatAction,
  sendChatMessageAction: mocks.sendChatMessageAction,
  loadOlderMessagesAction: mocks.loadOlderMessagesAction,
  markChatReadAction: mocks.markChatReadAction,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: mocks.createClient,
}))

const currentUserId = "177f3329-6c04-4c40-8f33-873ab3ee4f76"
const otherUserId = "277f3329-6c04-4c40-8f33-873ab3ee4f76"
const chatId = "377f3329-6c04-4c40-8f33-873ab3ee4f76"
const listingId = "477f3329-6c04-4c40-8f33-873ab3ee4f76"

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "577f3329-6c04-4c40-8f33-873ab3ee4f76",
    chat_id: chatId,
    sender_id: otherUserId,
    body: "გამარჯობა",
    created_at: "2026-08-04T08:00:00.000Z",
    ...overrides,
  }
}

function realtimeClient() {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }
  return {
    channel: vi.fn().mockReturnValue(channel),
    removeChannel: vi.fn().mockResolvedValue(undefined),
  }
}

describe("chat components", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockReturnValue(realtimeClient())
    mocks.markChatReadAction.mockResolvedValue({ ok: true })
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  it("does not create a conversation when the listing CTA only opens", async () => {
    const user = userEvent.setup()
    render(
      <StartChatButton
        listingId={listingId}
        listingSlug="linen-jacket"
        label="მიწერე გამყიდველს"
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "მიწერე გამყიდველს" }),
    )

    expect(
      screen.getByRole("heading", { name: "პირველი შეტყობინება" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("შეტყობინება")).toHaveAttribute(
      "maxlength",
      String(CHAT_MESSAGE_MAX_LENGTH),
    )
    expect(mocks.startChatAction).not.toHaveBeenCalled()
  })

  it("renders HTML-like message input as text and identifies the sender without color alone", () => {
    const xss = "<script>alert('x')</script>\nhttps://example.com/" + "a".repeat(180)
    render(
      <ChatThreadClient
        chatId={chatId}
        currentUserId={currentUserId}
        initialMessages={[message({ body: xss })]}
        otherPartyLabel="ნინო"
        canSend
        initialHasMore={false}
      />,
    )

    expect(screen.getByText(/alert\('x'\)/)).toHaveTextContent(
      "https://example.com/",
    )
    expect(document.querySelector("script")).not.toBeInTheDocument()
    expect(screen.getByText("ნინო წერს:")).toHaveClass("sr-only")
  })

  it("keeps composer text after a server failure", async () => {
    const user = userEvent.setup()
    mocks.sendChatMessageAction.mockResolvedValue({
      ok: false,
      code: "server_error",
      message: "შეტყობინება ვერ გაიგზავნა.",
    })
    render(
      <ChatThreadClient
        chatId={chatId}
        currentUserId={currentUserId}
        initialMessages={[]}
        otherPartyLabel="ნინო"
        canSend
        initialHasMore={false}
      />,
    )

    const composer = screen.getByLabelText("შეტყობინება")
    await user.type(composer, "ჩემი ტექსტი")
    await user.click(screen.getByRole("button", { name: "გაგზავნა" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "შეტყობინება ვერ გაიგზავნა.",
    )
    expect(composer).toHaveValue("ჩემი ტექსტი")
  })

  it("clears text only after a committed server response", async () => {
    const user = userEvent.setup()
    mocks.sendChatMessageAction.mockResolvedValue({
      ok: true,
      message: message({
        sender_id: currentUserId,
        body: "ჩემი პასუხი",
      }),
    })
    render(
      <ChatThreadClient
        chatId={chatId}
        currentUserId={currentUserId}
        initialMessages={[]}
        otherPartyLabel="ნინო"
        canSend
        initialHasMore={false}
      />,
    )

    const composer = screen.getByLabelText("შეტყობინება")
    await user.type(composer, "ჩემი პასუხი")
    await user.click(screen.getByRole("button", { name: "გაგზავნა" }))

    await waitFor(() => expect(composer).toHaveValue(""))
    expect(screen.getByText("ჩემი პასუხი")).toBeInTheDocument()
    expect(screen.getByText("შენ დაწერე:")).toHaveClass("sr-only")
    expect(mocks.sendChatMessageAction).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId,
        body: "ჩემი პასუხი",
        clientRequestId: expect.any(String),
      }),
    )
  })

  it("loads older messages through the bounded participant action", async () => {
    mocks.loadOlderMessagesAction.mockResolvedValue({
      ok: true,
      messages: [
        message({
          id: "677f3329-6c04-4c40-8f33-873ab3ee4f76",
          body: "ძველი შეტყობინება",
          created_at: "2026-08-03T08:00:00.000Z",
        }),
      ],
      hasMore: false,
    })
    render(
      <ChatThreadClient
        chatId={chatId}
        currentUserId={currentUserId}
        initialMessages={[message()]}
        otherPartyLabel="ნინო"
        canSend
        initialHasMore
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "ძველი შეტყობინებების ჩატვირთვა" }),
    )

    expect(await screen.findByText("ძველი შეტყობინება")).toBeInTheDocument()
    expect(mocks.loadOlderMessagesAction).toHaveBeenCalledWith(
      chatId,
      expect.objectContaining({
        createdAt: "2026-08-04T08:00:00.000Z",
      }),
    )
  })

  it("keeps history visible but removes the composer for a read-only listing status", () => {
    render(
      <ChatThreadClient
        chatId={chatId}
        currentUserId={currentUserId}
        initialMessages={[message()]}
        otherPartyLabel="ნინო"
        canSend={false}
        initialHasMore={false}
      />,
    )

    expect(screen.getByText("გამარჯობა")).toBeInTheDocument()
    expect(screen.queryByLabelText("შეტყობინება")).not.toBeInTheDocument()
    expect(screen.getByText(/ისტორია ხელმისაწვდომია/)).toBeInTheDocument()
  })
})
