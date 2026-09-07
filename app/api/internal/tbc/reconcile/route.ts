import { NextResponse } from "next/server"
import { reconcilePendingTbcOrders } from "@/lib/tbc-sync"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const cronSecret = String(process.env.CRON_SECRET ?? "").trim()
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "reconciliation_not_configured" }, { status: 503 })
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const result = await reconcilePendingTbcOrders(5)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[tbc] protected reconciliation route failed", error instanceof Error ? error.message : "unknown error")
    return NextResponse.json({ ok: false, error: "reconciliation_failed" }, { status: 500 })
  }
}
