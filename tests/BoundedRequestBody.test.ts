// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { readBoundedRequestBody } from "@/lib/bounded-request-body"

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))

const MAX_BYTES = 32_768

function chunkedRequest(chunks: Uint8Array[], headers?: HeadersInit) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
  return new Request("https://samosell.ge/api/payments/flitt/callback", {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" })
}

describe("bounded request body", () => {
  it("accepts bodies at the exact byte limit", async () => {
    const request = chunkedRequest([new Uint8Array(MAX_BYTES).fill(97)])
    await expect(readBoundedRequestBody(request, MAX_BYTES)).resolves.toHaveLength(MAX_BYTES)
  })

  it("rejects an oversized declared Content-Length before reading the stream", async () => {
    let bodyAccessed = false
    const request = {
      headers: new Headers({ "content-length": String(MAX_BYTES + 1) }),
      get body() {
        bodyAccessed = true
        throw new Error("body should not be read")
      },
    } as unknown as Request

    await expect(readBoundedRequestBody(request, MAX_BYTES)).rejects.toMatchObject({
      code: "payload_too_large",
      httpStatus: 413,
    })
    expect(bodyAccessed).toBe(false)
  })

  it("rejects an oversized chunked body while streaming", async () => {
    const request = chunkedRequest([
      new Uint8Array(20_000).fill(97),
      new Uint8Array(12_769).fill(98),
    ])

    await expect(readBoundedRequestBody(request, MAX_BYTES)).rejects.toMatchObject({
      code: "payload_too_large",
      httpStatus: 413,
    })
  })

  it("rejects malformed UTF-8 without returning a partial string", async () => {
    const request = chunkedRequest([new Uint8Array([0xc3, 0x28])])
    await expect(readBoundedRequestBody(request, MAX_BYTES)).rejects.toMatchObject({
      code: "invalid_body",
      httpStatus: 400,
    })
  })

  it("returns 413 before the Next.js callback reaches payment lookup", async () => {
    const { POST } = await import("@/app/api/payments/flitt/callback/route")
    const request = new Request("https://samosell.ge/api/payments/flitt/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_BYTES + 1),
      },
      body: "{}",
    })

    const response = await POST(request)
    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({ error: "callback_too_large" })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
