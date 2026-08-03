import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  loadOlderMessagesAction,
  markChatReadAction,
  sendChatMessageAction,
  startChatAction,
  updateChatVisibilityAction,
} from "@/app/dashboard/chats/actions"

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}))

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

const buyerId = "177f3329-6c04-4c40-8f33-873ab3ee4f76"
const listingId = "277f3329-6c04-4c40-8f33-873ab3ee4f76"
const chatId = "377f3329-6c04-4c40-8f33-873ab3ee4f76"
const messageId = "477f3329-6c04-4c40-8f33-873ab3ee4f76"
const requestId = "577f3329-6c04-4c40-8f33-873ab3ee4f76"
const createdAt = "2026-08-04T08:00:00.000Z"

function auth(user: { id: string } | null) {
  return {
    getUser: vi.fn().mockResolvedValue({
      data: { user },
      error: null,
    }),
  }
}

function rpcSingle(data: unknown, error: unknown = null) {
  return {
    single: vi.fn().mockResolvedValue({ data, error }),
  }
}

function membershipBuilder(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
}

function messagesBuilder(data: unknown[], error: unknown = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
  }
  return builder
}

describe("chat server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`)
    })
  })

  it("creates the conversation only through the atomic first-message RPC", async () => {
    const rpc = vi.fn().mockReturnValue(
      rpcSingle({
        chat_id: chatId,
        message_id: messageId,
        message_body: "გამარჯობა",
        message_created_at: createdAt,
      }),
    )
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase: { rpc },
      user: { id: buyerId },
    })
    const formData = new FormData()
    formData.set("listingId", listingId)
    formData.set("listingSlug", "linen-jacket")
    formData.set("clientRequestId", requestId)
    formData.set("body", "  გამარჯობა  ")
    formData.set("sellerId", "forged-seller")
    formData.set("senderId", "forged-sender")

    await expect(
      startChatAction({ ok: false, message: "" }, formData),
    ).rejects.toThrow(`REDIRECT:/dashboard/chats/${chatId}`)

    expect(rpc).toHaveBeenCalledWith("start_chat_with_message", {
      p_listing_id: listingId,
      p_body: "გამარჯობა",
      p_client_request_id: requestId,
    })
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("sellerId")
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("senderId")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/chats")
  })

  it("does not create an empty conversation", async () => {
    const rpc = vi.fn()
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase: { rpc },
      user: { id: buyerId },
    })
    const formData = new FormData()
    formData.set("listingId", listingId)
    formData.set("listingSlug", "linen-jacket")
    formData.set("clientRequestId", requestId)
    formData.set("body", "   ")

    const result = await startChatAction({ ok: false, message: "" }, formData)

    expect(result).toMatchObject({ ok: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("denies an unauthenticated direct message before database mutation", async () => {
    const rpc = vi.fn()
    mocks.createClient.mockResolvedValue({ auth: auth(null), rpc })

    const result = await sendChatMessageAction({
      chatId,
      body: "გამარჯობა",
      clientRequestId: requestId,
    })

    expect(result).toMatchObject({ ok: false, code: "unauthorized" })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("derives sender from the authenticated session and returns committed data", async () => {
    const rpc = vi.fn().mockReturnValue(
      rpcSingle({
        message_id: messageId,
        message_body: "პასუხი",
        message_created_at: createdAt,
      }),
    )
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: buyerId }),
      rpc,
    })

    const result = await sendChatMessageAction({
      chatId,
      body: " პასუხი ",
      clientRequestId: requestId,
      senderId: "forged",
    } as Parameters<typeof sendChatMessageAction>[0] & { senderId: string })

    expect(result).toEqual({
      ok: true,
      message: {
        id: messageId,
        chat_id: chatId,
        sender_id: buyerId,
        body: "პასუხი",
        created_at: createdAt,
      },
    })
    expect(rpc).toHaveBeenCalledWith("send_chat_message", {
      p_chat_id: chatId,
      p_body: "პასუხი",
      p_client_request_id: requestId,
    })
  })

  it("keeps raw database details private on a send failure", async () => {
    const rpc = vi.fn().mockReturnValue(
      rpcSingle(null, { message: "postgres secret constraint detail" }),
    )
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: buyerId }),
      rpc,
    })

    const result = await sendChatMessageAction({
      chatId,
      body: "გამარჯობა",
      clientRequestId: requestId,
    })

    expect(result).toMatchObject({ ok: false, code: "server_error" })
    if (!result.ok) expect(result.message).not.toContain("postgres")
  })

  it("checks membership before a bounded older-message query", async () => {
    const membership = membershipBuilder({ id: chatId })
    const messages = messagesBuilder([
      {
        id: messageId,
        chat_id: chatId,
        sender_id: buyerId,
        body: "ძველი",
        created_at: "2026-08-03T08:00:00.000Z",
      },
    ])
    const from = vi
      .fn()
      .mockReturnValueOnce(membership)
      .mockReturnValueOnce(messages)
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: buyerId }),
      from,
    })

    const result = await loadOlderMessagesAction(chatId, {
      id: requestId,
      createdAt,
    })

    expect(result).toMatchObject({ ok: true, hasMore: false })
    expect(membership.eq).toHaveBeenCalledWith("id", chatId)
    expect(membership.or).toHaveBeenCalledWith(
      `buyer_id.eq.${buyerId},seller_id.eq.${buyerId}`,
    )
    expect(messages.eq).toHaveBeenCalledWith("chat_id", chatId)
    expect(messages.limit).toHaveBeenCalledWith(51)
  })

  it("returns the same private-safe denial for a non-participant cursor request", async () => {
    const membership = membershipBuilder(null)
    const from = vi.fn().mockReturnValue(membership)
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: buyerId }),
      from,
    })

    const result = await loadOlderMessagesAction(chatId, {
      id: requestId,
      createdAt,
    })

    expect(result).toMatchObject({ ok: false, code: "not_found" })
    expect(from).toHaveBeenCalledTimes(1)
  })

  it("marks only the current participant read through a narrow RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: buyerId }),
      rpc,
    })

    await expect(markChatReadAction(chatId)).resolves.toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith("mark_chat_read", {
      p_chat_id: chatId,
    })
  })

  it("archives through the participant-scoped RPC without trusting a redirect URL", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase: { rpc },
      user: { id: buyerId },
    })
    const formData = new FormData()
    formData.set("chatId", chatId)
    formData.set("intent", "archive")
    formData.set("returnTo", "https://evil.example")

    await expect(updateChatVisibilityAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/chats",
    )
    expect(rpc).toHaveBeenCalledWith("set_chat_archived", {
      p_chat_id: chatId,
      p_archived: true,
    })
  })
})
