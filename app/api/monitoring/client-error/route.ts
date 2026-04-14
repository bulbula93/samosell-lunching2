import { NextResponse } from "next/server"
import { captureServerError } from "@/lib/monitoring"

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null)
    captureServerError("client_error", new Error("client_error_reported"), payload && typeof payload === "object" ? (payload as Record<string, unknown>) : undefined)
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureServerError("client_error_route", error)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
