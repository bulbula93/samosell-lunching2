import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(() => true),
  sync: vi.fn(),
}))
vi.mock("@/lib/tbc", () => ({ isTbcCheckoutEnabled: mocks.enabled }))
vi.mock("@/lib/tbc-sync", () => ({ syncBoostOrderFromTbcByPayId: mocks.sync }))

const route = readFileSync("app/api/tbc/checkout/callback/route.ts", "utf8")

describe("TBC callback boundary", () => {
  beforeEach(() => {
    mocks.enabled.mockReturnValue(true)
    mocks.sync.mockReset().mockResolvedValue({ outcome: "applied" })
  })

  it("bounds and validates the provider payload", () => {
    expect(route).toContain("MAX_CALLBACK_BYTES")
    expect(route).toContain("PAYMENT_ID_PATTERN")
    expect(route).toContain('status: 413')
  })

  it("does not return internal exception details to the caller", () => {
    expect(route).toContain('error: "Callback processing failed"')
    expect(route).not.toContain('error: message')
  })

  it("does not parse or sync callbacks while checkout is disabled", async () => {
    mocks.enabled.mockReturnValue(false)
    const { POST } = await import("@/app/api/tbc/checkout/callback/route")
    const response = await POST(new Request("https://samosell.ge/api/tbc/checkout/callback", {
      method: "POST", body: JSON.stringify({ PaymentId: "payment-1" }),
      headers: { "content-type": "application/json" },
    }))
    expect(response.status).toBe(503)
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it("rejects malformed callback payloads without provider access", async () => {
    const { POST } = await import("@/app/api/tbc/checkout/callback/route")
    const response = await POST(new Request("https://samosell.ge/api/tbc/checkout/callback", {
      method: "POST", body: "not-json", headers: { "content-type": "application/json" },
    }))
    expect(response.status).toBe(400)
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it("stops reading a streamed body once the callback limit is exceeded", async () => {
    const { POST } = await import("@/app/api/tbc/checkout/callback/route")
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(10_000))
        controller.enqueue(new Uint8Array(10_000))
        controller.close()
      },
    })
    const response = await POST(new Request("https://samosell.ge/api/tbc/checkout/callback", {
      method: "POST", body, duplex: "half",
    } as RequestInit & { duplex: "half" }))
    expect(response.status).toBe(413)
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it("accepts a valid payment id and returns no provider details", async () => {
    const { POST } = await import("@/app/api/tbc/checkout/callback/route")
    const response = await POST(new Request("https://samosell.ge/api/tbc/checkout/callback", {
      method: "POST", body: "PaymentId=payment-1",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mocks.sync).toHaveBeenCalledWith("payment-1", "callback")
  })
})
