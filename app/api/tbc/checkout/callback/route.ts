import { NextResponse } from "next/server"
import { syncBoostOrderFromTbcByPayId } from "@/lib/tbc-sync"

const MAX_CALLBACK_BYTES = 16_384
const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/

async function readPaymentId(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || "0")
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CALLBACK_BYTES) {
    throw new Error("callback_payload_too_large")
  }

  const contentType = request.headers.get("content-type") || ""
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_CALLBACK_BYTES) {
    throw new Error("callback_payload_too_large")
  }
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
  try {
    const paymentId = await readPaymentId(request)

    if (!PAYMENT_ID_PATTERN.test(paymentId)) {
      return NextResponse.json({ ok: false, error: "Invalid callback payload" }, { status: 400 })
    }

    const result = await syncBoostOrderFromTbcByPayId(paymentId, "callback")
    return NextResponse.json({ ok: true, status: result.order?.status ?? null, providerStatus: result.payment?.status ?? null })
  } catch (error) {
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
