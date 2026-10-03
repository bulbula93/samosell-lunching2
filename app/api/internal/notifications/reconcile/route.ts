import { NextResponse } from "next/server"
import { reconcileUsefulListingNotifications } from "@/lib/notification-reminders"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function isAuthorized(request: Request) {
  const authorization = String(request.headers.get("authorization") ?? "").trim()
  if (!authorization.startsWith("Bearer ")) return false

  const providedToken = authorization.slice("Bearer ".length).trim()
  if (!providedToken) return false

  const envSecret = String(process.env.CRON_SECRET ?? "").trim()
  if (envSecret && providedToken === envSecret) return true

  const { data, error } = await createAdminClient().rpc("verify_tbc_recovery_token", {
    p_token: providedToken,
  })
  return !error && data === true
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const result = await reconcileUsefulListingNotifications()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error(
      "[notifications] reconciliation failed",
      error instanceof Error ? error.message : "unknown error",
    )
    return NextResponse.json({ ok: false, error: "reconciliation_failed" }, { status: 500 })
  }
}
