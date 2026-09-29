import { beforeEach, describe, expect, it, vi } from "vitest"
import { sendSupportMessageAction } from "@/app/contact/actions"

const TICKET_ID = "8f6cf524-8902-4f63-9ea6-bb75ef76f08b"

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  sendTransactionalEmail: vi.fn(),
  enforceRateLimit: vi.fn(),
  getSupportConfig: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}))

vi.mock("@/lib/email", () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}))

vi.mock("@/lib/site", () => ({
  getSupportConfig: mocks.getSupportConfig,
}))

function auth(user: { id: string; email?: string | null } | null, error: unknown = null) {
  return {
    getUser: vi.fn().mockResolvedValue({
      data: { user },
      error,
    }),
  }
}

function client(
  user: { id: string; email?: string | null } | null,
  options?: { authError?: unknown; ticketError?: unknown },
) {
  return {
    auth: auth(user, options?.authError ?? null),
    rpc: vi.fn().mockResolvedValue({
      data: options?.ticketError ? null : TICKET_ID,
      error: options?.ticketError ?? null,
    }),
  }
}

describe("support contact action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSupportConfig.mockReturnValue({ supportEmail: "support@samosell.ge" })
    mocks.enforceRateLimit.mockResolvedValue(undefined)
    mocks.sendTransactionalEmail.mockResolvedValue({ ok: true })
  })

  it("requires a signed-in account with an email address", async () => {
    mocks.createClient.mockResolvedValue(client(null))

    const result = await sendSupportMessageAction({
      category: "account",
      subject: "ანგარიშის პრობლემა",
      message: "დახმარება მჭირდება ანგარიშთან დაკავშირებით.",
    })

    expect(result.ok).toBe(false)
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled()
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled()
  })

  it("persists the ticket, derives Reply-To from auth, and sends support email", async () => {
    const supabase = client({
      id: "177f3329-6c04-4c40-8f33-873ab3ee4f76",
      email: "User@Example.com",
    })
    mocks.createClient.mockResolvedValue(supabase)

    const result = await sendSupportMessageAction({
      category: "chat",
      subject: "ჩათის პრობლემა",
      message: "ჩათში შეტყობინების გაგზავნა ვერ მოვახერხე.",
    })

    expect(result.ok).toBe(true)
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, "support_contact")
    expect(supabase.rpc).toHaveBeenCalledWith("submit_support_ticket", {
      p_category: "chat",
      p_subject: "ჩათის პრობლემა",
      p_message: "ჩათში შეტყობინების გაგზავნა ვერ მოვახერხე.",
    })
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "support@samosell.ge",
        replyTo: "user@example.com",
        subject: expect.stringContaining("ჩათის პრობლემა"),
        text: expect.stringContaining("Ticket: 8F6CF524"),
      }),
    )
  })

  it("escapes user content in HTML email output", async () => {
    mocks.createClient.mockResolvedValue(
      client({
        id: "177f3329-6c04-4c40-8f33-873ab3ee4f76",
        email: "user@example.com",
      }),
    )

    await sendSupportMessageAction({
      category: "technical",
      subject: "<b>ტესტი</b>",
      message: "<script>alert('x')</script> პრობლემა მაქვს",
    })

    const payload = mocks.sendTransactionalEmail.mock.calls[0]?.[0]
    expect(payload.html).toContain("&lt;b&gt;ტესტი&lt;/b&gt;")
    expect(payload.html).toContain("&lt;script&gt;")
    expect(payload.html).not.toContain("<script>")
  })

  it("rejects invalid content before rate limiting, persistence, or delivery", async () => {
    const supabase = client({
      id: "177f3329-6c04-4c40-8f33-873ab3ee4f76",
      email: "user@example.com",
    })
    mocks.createClient.mockResolvedValue(supabase)

    const result = await sendSupportMessageAction({
      category: "account",
      subject: "x",
      message: "short",
    })

    expect(result.ok).toBe(false)
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it("does not send email when durable ticket persistence fails", async () => {
    mocks.createClient.mockResolvedValue(
      client(
        {
          id: "177f3329-6c04-4c40-8f33-873ab3ee4f76",
          email: "user@example.com",
        },
        { ticketError: { message: "database unavailable" } },
      ),
    )

    const result = await sendSupportMessageAction({
      category: "other",
      subject: "სხვა საკითხი",
      message: "მხარდაჭერის გუნდთან დაკავშირება მსურს.",
    })

    expect(result).toEqual({
      ok: false,
      message: "მოთხოვნა ახლა ვერ შეინახა. სცადე ცოტა მოგვიანებით.",
    })
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it("keeps the durable ticket when email notification delivery fails", async () => {
    mocks.createClient.mockResolvedValue(
      client({
        id: "177f3329-6c04-4c40-8f33-873ab3ee4f76",
        email: "user@example.com",
      }),
    )
    mocks.sendTransactionalEmail.mockResolvedValue({
      ok: false,
      skipped: false,
      status: 500,
    })

    const result = await sendSupportMessageAction({
      category: "other",
      subject: "სხვა საკითხი",
      message: "მხარდაჭერის გუნდთან დაკავშირება მსურს.",
    })

    expect(result.ok).toBe(true)
    expect(result.message).toContain("Support Inbox-ში შენახულია")
    expect(result.message).not.toContain("500")
  })
})
