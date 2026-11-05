import { NextResponse } from "next/server"
import { captureServerError } from "@/lib/monitoring"
import { createHash } from "node:crypto"
import { BoundedBodyError, readBoundedRequestBody } from "@/lib/bounded-request-body"
import { isSameOriginMutation } from "@/lib/security-headers"

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 })
  try {
    const payload = JSON.parse(await readBoundedRequestBody(request, 8192)) as Record<string, unknown> | null
    // Client messages, source URLs and arbitrary fields may contain credentials
    // or personal data. Keep only bounded categorical metadata and a fingerprint.
    const type = payload?.type === "unhandledrejection" ? "unhandledrejection" : "error"
    const message = typeof payload?.message === "string" ? payload.message.slice(0, 2000) : ""
    captureServerError("client_error", new Error("client_error_reported"), {
      type, fingerprint: createHash("sha256").update(message).digest("hex").slice(0, 16),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof BoundedBodyError) return NextResponse.json({ error: error.code }, { status: error.httpStatus })
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
}
