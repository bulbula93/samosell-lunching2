import { NextResponse } from "next/server"
import { syncBoostOrderFromTbcByPayId } from "@/lib/tbc-sync"
import { isTbcCheckoutEnabled } from "@/lib/tbc"

const MAX_CALLBACK_BYTES = 16_384
const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/

async function readPaymentId(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || "0")
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CALLBACK_BYTES) {
    throw new Error("callback_payload_too_large")
  }

  const contentType = request.headers.get("content-type") || ""
  const reader = request.body?.getReader()
  const chunks: Uint8Array[] = []
  let receivedBytes = 0
  if (reader) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      receivedBytes += value.byteLength
      if (receivedBytes > MAX_CALLBACK_BYTES) {
        await reader.cancel()
        throw new Error("callback_payload_too_large")
      }
      chunks.push(value)
    }
  }
  const body = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  const raw = new TextDecoder().decode(body)
  if (!raw) return ""

  if (contentType.includes("application/json")) {
    const payload = JSON.parse(raw) as { PaymentId?: string; paymentId?: string } | null
    return String(payload?.PaymentId || payload?.paymentId || "").trim()
  }

  if (contentType.includes("application/x-www-form-urlencoded") || raw.includes("PaymentId=") || raw.includes("paymentId=")) {
    const params = new URLSearchParams(raw)
    return String(params.get("PaymentId") || params.get("paymentId") || "").trim()
  }

  try {
    const payload = JSON.parse(raw) as { PaymentId?: string; paymentId?: string } | null
    return String(payload?.PaymentId || payload?.paymentId || "").trim()
  } catch {
    // ignore and continue with regex fallback
  }

  const match = raw.match(/(?:PaymentId|paymentId)\s*[:=]\s*"?([A-Za-z0-9_-]+)"?/)
  return match ? String(match[1]).trim() : ""
}

export async function POST(request: Request) {
  if (!isTbcCheckoutEnabled()) return NextResponse.json({ ok: false, error: "Checkout disabled" }, { status: 503 })
  try {
    const paymentId = await readPaymentId(request)

    if (!PAYMENT_ID_PATTERN.test(paymentId)) {
      return NextResponse.json({ ok: false, error: "Invalid callback payload" }, { status: 400 })
    }

    const result = await syncBoostOrderFromTbcByPayId(paymentId, "callback")
    if (result.outcome === "busy" || result.outcome === "stale") {
      return NextResponse.json({ ok: false, error: "Retry later" }, { status: 503, headers: { "Retry-After": "60" } })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ ok: false, error: "Invalid callback payload" }, { status: 400 })
    if (error instanceof Error && error.message === "callback_payload_too_large") {
      return NextResponse.json({ ok: false, error: "Callback payload too large" }, { status: 413 })
    }

    console.error(
      "[tbc] checkout callback failed",
      error instanceof Error ? error.message : "unknown error",
    )
    return NextResponse.json({ ok: false, error: "Callback processing failed" }, { status: 500 })
  }
}
