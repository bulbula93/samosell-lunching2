import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
    vi.stubGlobal("scrollTo", vi.fn())
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
      screen.getByRole("heading", { name: "გამყიდველი" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("შეტყობინება")).toHaveAttribute(
      "maxlength",
      String(CHAT_MESSAGE_MAX_LENGTH),
    )
    expect(mocks.startChatAction).not.toHaveBeenCalled()
  })

  it("opens the sheet outside its action bar and follows the keyboard viewport", async () => {
    const user = userEvent.setup()
    const viewport = Object.assign(new EventTarget(), {
      offsetTop: 0,
      offsetLeft: 0,
      width: 390,
      height: 844,
    })
    vi.stubGlobal("visualViewport", viewport)
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }))
    vi.stubGlobal("scrollY", 240)
    const previousTop = document.body.style.top
    const previousOverflow = document.body.style.overflow
    const { container } = render(
      <div style={{ backdropFilter: "blur(8px)" }}>
        <StartChatButton
          listingId={listingId}
          listingSlug="linen-jacket"
          presentation="responsive"
        />
      </div>,
    )

    await user.click(screen.getByRole("button", { name: "მიწერე გამყიდველს" }))
    const dialog = screen.getByRole("dialog", { name: "პირველი შეტყობინება" })
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(dialog.parentElement).toHaveAttribute("data-chat-screen")
    expect(container).not.toContainElement(dialog)
    expect(dialog).toHaveStyle({ width: "390px", height: "844px", top: "0px" })
    expect(document.body.style.overflow).toBe("hidden")
    expect(document.body).toHaveStyle({ position: "fixed", top: "-240px" })
    expect(document.documentElement.style.overflow).toBe("hidden")

    Object.assign(viewport, { offsetTop: 96, height: 360 })
    viewport.dispatchEvent(new Event("resize"))
    expect(dialog).toHaveStyle({ width: "390px", height: "360px", top: "96px" })
    expect(dialog.style.getPropertyValue("--chat-bottom-inset")).toBe("0px")

    fireEvent.touchStart(dialog, { touches: [{ clientY: 100 }] })
    const overscroll = new Event("touchmove", { bubbles: true, cancelable: true })
    Object.defineProperty(overscroll, "touches", { value: [{ clientY: 80 }] })
    dialog.dispatchEvent(overscroll)
    expect(overscroll.defaultPrevented).toBe(true)

    const field = screen.getByLabelText("შეტყობინება")
    Object.defineProperties(field, { scrollHeight: { value: 200 }, clientHeight: { value: 44 } })
    fireEvent.touchStart(field, { touches: [{ clientY: 100 }] })
    const innerScroll = new Event("touchmove", { bubbles: true, cancelable: true })
    Object.defineProperty(innerScroll, "touches", { value: [{ clientY: 80 }] })
    field.dispatchEvent(innerScroll)
    expect(innerScroll.defaultPrevented).toBe(false)

    Object.assign(viewport, { offsetTop: 120, offsetLeft: 8, width: 374 })
    viewport.dispatchEvent(new Event("scroll"))
    expect(dialog).toHaveStyle({ width: "374px", left: "8px", top: "120px" })
    expect(mocks.startChatAction).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "შეტყობინების ფორმის დახურვა" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe(previousOverflow)
    expect(document.body.style.position).toBe("")
    expect(document.body.style.top).toBe(previousTop)
    expect(document.documentElement.style.overflow).toBe("")
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 240, behavior: "instant" })
  })

  it("keeps the first-message draft when a suggested message cannot be sent", async () => {
    const user = userEvent.setup()
    mocks.startChatAction.mockResolvedValue({ ok: false, message: "დროებით ვერ გაიგზავნა." })
    render(<StartChatButton listingId={listingId} listingSlug="linen-jacket" sellerLabel="ნინო" listingTitle="შავი ქურთუკი" priceLabel="55 ₾" />)
    await user.click(screen.getByRole("button", { name: "მიწერე გამყიდველს" }))
    expect(screen.getByRole("heading", { name: "ნინო" })).toBeInTheDocument()
    expect(screen.getByText("შავი ქურთუკი")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "გაგზავნა" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "ჯერ კიდევ იყიდება?" }))
    expect(mocks.startChatAction).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "გაგზავნა" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("დროებით ვერ გაიგზავნა.")
    expect(screen.getByLabelText("შეტყობინება")).toHaveValue("ჯერ კიდევ იყიდება?")
    expect(mocks.startChatAction.mock.calls[0][1].get("body")).toBe("ჯერ კიდევ იყიდება?")
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

  it("keeps the mobile composer keyboard-aware and safe-area padded", () => {
    render(
      <ChatThreadClient
        chatId={chatId}
        currentUserId={currentUserId}
        initialMessages={[message()]}
        otherPartyLabel="ნინო"
        canSend
        initialHasMore={false}
      />,
    )

    const composer = screen.getByLabelText("შეტყობინება")
    expect(composer).toHaveAttribute("enterkeyhint", "send")
    expect(composer.closest("form")).toHaveStyle({
      paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
    })
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
