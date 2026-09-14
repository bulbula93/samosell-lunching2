import { NextResponse } from "next/server"

function safeOrderId(value: unknown) {
  const orderId = String(value ?? "").trim()
  return orderId && orderId.length <= 1024 ? orderId : null
}

function resultRedirect(request: Request, orderId: string | null) {
  const url = new URL("/payment/result", request.url)
  if (orderId) url.searchParams.set("order", orderId)
  return NextResponse.redirect(url, 303)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  return resultRedirect(request, safeOrderId(url.searchParams.get("order_id") ?? url.searchParams.get("order")))
}

export async function POST(request: Request) {
  const text = await request.text()
  const contentType = request.headers.get("content-type") ?? ""
  let orderId: string | null = null

  try {
    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(text) as Record<string, unknown>
      const params = parsed.response && typeof parsed.response === "object"
        ? parsed.response as Record<string, unknown>
        : parsed
      orderId = safeOrderId(params.order_id)
    } else {
      orderId = safeOrderId(new URLSearchParams(text).get("order_id"))
    }
  } catch {
    orderId = null
  }

  // Browser return data is intentionally display-only. Payment state is changed
  // exclusively by the signed server_callback_url handler.
  return resultRedirect(request, orderId)
}
