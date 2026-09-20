import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { reconcilePendingTbcOrders, reconcileProcessingTbcRefunds } from "@/lib/tbc-sync"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function isAuthorizedRecoveryRequest(request: Request) {
  const authorization = String(request.headers.get("authorization") ?? "").trim()
  if (!authorization.startsWith("Bearer ")) return false

  const providedToken = authorization.slice("Bearer ".length).trim()
  if (!providedToken) return false

  const envSecret = String(process.env.CRON_SECRET ?? "").trim()
  if (envSecret && providedToken === envSecret) return true

  const { data, error } = await createAdminClient().rpc("verify_tbc_recovery_token", {
    p_token: providedToken,
  })
  if (error) {
    console.error("[tbc] recovery token verification failed", error.message)
    return false
  }
  return data === true
}

export async function GET(request: Request) {
  if (!(await isAuthorizedRecoveryRequest(request))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    // Keep the batch small enough to stay comfortably within the function
    // duration even if TBC status calls approach their network timeout.
    const refunds = await reconcileProcessingTbcRefunds(2)
    const payments = await reconcilePendingTbcOrders(2)

    return NextResponse.json({
      ok: true,
      payments,
      refunds,
    })
  } catch (error) {
    console.error("[tbc] protected reconciliation route failed", error instanceof Error ? error.message : "unknown error")
    return NextResponse.json({ ok: false, error: "reconciliation_failed" }, { status: 500 })
  }
}
