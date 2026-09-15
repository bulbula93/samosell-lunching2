import { describe, expect, it, vi } from "vitest"
import {
  MAX_BODY_BYTES,
  parseCallbackBody,
  readBoundedBody,
} from "@/supabase/functions/flitt-callback/body"

function chunkedRequest(chunks: Uint8Array[], headers: HeadersInit = {}) {
  let index = 0
  const cancel = vi.fn()
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) controller.close()
      else controller.enqueue(chunks[index++])
    },
    cancel,
  })
  return {
    request: new Request("https://callback.invalid", {
      method: "POST",
      headers,
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
    cancel,
  }
}

describe("Flitt callback bounded body reader", () => {
  it("accepts a URL-encoded body below 32 KiB", async () => {
    const request = new Request("https://callback.invalid", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "order_id=small&amount=100",
    })
    await expect(parseCallbackBody(request)).resolves.toMatchObject({ order_id: "small", amount: "100" })
  })

  it("accepts exactly 32 KiB", async () => {
    const raw = `order_id=${"a".repeat(MAX_BODY_BYTES - "order_id=".length)}`
    expect(new TextEncoder().encode(raw)).toHaveLength(MAX_BODY_BYTES)
    const request = new Request("https://callback.invalid", { method: "POST", body: raw })
    await expect(readBoundedBody(request, MAX_BODY_BYTES)).resolves.toBe(raw)
  })

  it("rejects an oversized Content-Length before reading the stream", async () => {
    const pull = vi.fn()
    const request = new Request("https://callback.invalid", {
      method: "POST",
      headers: { "content-length": String(MAX_BODY_BYTES + 1) },
      body: new ReadableStream<Uint8Array>({ pull }),
      duplex: "half",
    } as RequestInit & { duplex: "half" })
    await expect(readBoundedBody(request, MAX_BODY_BYTES)).rejects.toMatchObject({
      code: "callback_too_large",
      httpStatus: 413,
    })
    expect(request.bodyUsed).toBe(false)
  })

  it("rejects and cancels an oversized chunked body", async () => {
    const encoder = new TextEncoder()
    const { request, cancel } = chunkedRequest([
      encoder.encode("a".repeat(20_000)),
      encoder.encode("b".repeat(20_000)),
    ])
    await expect(readBoundedBody(request, MAX_BODY_BYTES)).rejects.toMatchObject({
      code: "callback_too_large",
      httpStatus: 413,
    })
    expect(cancel).toHaveBeenCalled()
  })

  it("maps malformed JSON under the limit to invalid_callback_body", async () => {
    const request = new Request("https://callback.invalid", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    })
    await expect(parseCallbackBody(request)).rejects.toMatchObject({
      code: "invalid_callback_body",
      httpStatus: 400,
    })
  })

  it("rejects oversized payloads before downstream payment logic can be called", async () => {
    const lookupPayment = vi.fn()
    const { request } = chunkedRequest([new Uint8Array(MAX_BODY_BYTES + 1)])
    await expect((async () => {
      const body = await parseCallbackBody(request)
      return lookupPayment(body)
    })()).rejects.toMatchObject({ code: "callback_too_large", httpStatus: 413 })
    expect(lookupPayment).not.toHaveBeenCalled()
  })
})
