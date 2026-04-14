import { NextResponse } from "next/server"
import { syncBoostOrderFromTbcByPayId } from "@/lib/tbc-sync"

async function readPaymentId(request: Request) {
  const contentType = request.headers.get("content-type") || ""
  const raw = await request.text()
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

    if (!paymentId) {
      return NextResponse.json({ ok: false, error: "Missing PaymentId" }, { status: 400 })
    }

    const result = await syncBoostOrderFromTbcByPayId(paymentId, "callback")
    return NextResponse.json({ ok: true, status: result.order?.status ?? null, providerStatus: result.payment?.status ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown callback error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
