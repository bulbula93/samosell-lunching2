import { describe, expect, it } from "vitest"
import {
  CHAT_MESSAGE_MAX_LENGTH,
  canSendChatMessageForStatus,
  chatErrorMessage,
  isChatUuid,
  parseChatInboxFilter,
  parseChatPage,
  validateChatMessageBody,
} from "@/lib/chats"

describe("chat validation", () => {
  it("accepts trimmed plain text within the shared limit", () => {
    expect(validateChatMessageBody("  გამარჯობა  ")).toEqual({
      ok: true,
      body: "გამარჯობა",
    })
    expect(validateChatMessageBody("ა".repeat(CHAT_MESSAGE_MAX_LENGTH))).toMatchObject({
      ok: true,
    })
  })

  it.each([null, 7, "", "   "])("rejects empty or malformed body %#", (value) => {
    expect(validateChatMessageBody(value)).toMatchObject({ ok: false })
  })

  it("rejects an oversized body", () => {
    expect(
      validateChatMessageBody("ა".repeat(CHAT_MESSAGE_MAX_LENGTH + 1)),
    ).toMatchObject({ ok: false })
  })

  it("validates UUIDs and normalizes inbox query parameters", () => {
    expect(isChatUuid("177f3329-6c04-4c40-8f33-873ab3ee4f76")).toBe(true)
    expect(isChatUuid("../../other-user")).toBe(false)
    expect(parseChatInboxFilter("archived")).toBe("archived")
    expect(parseChatInboxFilter("owner=someone-else")).toBe("inbox")
    expect(parseChatPage("3")).toBe(3)
    expect(parseChatPage("-4")).toBe(1)
  })

  it("allows replies only for the explicit existing-conversation statuses", () => {
    expect(canSendChatMessageForStatus("active")).toBe(true)
    expect(canSendChatMessageForStatus("reserved")).toBe(true)
    expect(canSendChatMessageForStatus("sold")).toBe(true)
    expect(canSendChatMessageForStatus("archived")).toBe(false)
    expect(canSendChatMessageForStatus("draft")).toBe(false)
  })

  it("maps database errors to private-safe Georgian feedback", () => {
    expect(chatErrorMessage("message_too_long")).toContain(
      String(CHAT_MESSAGE_MAX_LENGTH),
    )
    expect(chatErrorMessage("postgres secret table detail")).not.toContain(
      "postgres",
    )
  })
})
