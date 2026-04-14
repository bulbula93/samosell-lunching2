import { NextResponse } from "next/server"
import { syncBoostOrderFromTbcByOrderId } from "@/lib/tbc-sync"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const orderId = String(url.searchParams.get("order") || "").trim()

  if (!orderId) {
    return NextResponse.redirect(new URL("/dashboard/billing?flash=tbc_missing_order", url))
  }

  try {
    const result = await syncBoostOrderFromTbcByOrderId(orderId, "return")
    const providerStatus = String(result?.payment?.status ?? ((result?.order as { provider_status?: string | null } | null)?.provider_status ?? ""))

    let flash = "tbc_pending"
    if (result?.order?.status === "active") flash = "tbc_activated"
    else if (providerStatus === "Succeeded" || providerStatus === "WaitingConfirm") flash = "tbc_success"
    else if (providerStatus === "Failed" || providerStatus === "Returned" || providerStatus === "PartialReturned") flash = "tbc_failed"
    else if (providerStatus === "Expired") flash = "tbc_expired"

    return NextResponse.redirect(new URL(`/dashboard/billing?flash=${encodeURIComponent(flash)}`, url))
  } catch {
    return NextResponse.redirect(new URL("/dashboard/billing?flash=tbc_error", url))
  }
}
