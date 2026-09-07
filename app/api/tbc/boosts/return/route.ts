import { NextResponse } from "next/server"
import { getSiteUrlEnv } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import { syncBoostOrderFromTbcByOrderId } from "@/lib/tbc-sync"
import { isTbcCheckoutEnabled } from "@/lib/tbc"

const ORDER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function billingRedirect(flash: string) {
  return NextResponse.redirect(new URL(`/dashboard/billing?flash=${encodeURIComponent(flash)}`, getSiteUrlEnv()))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const orderId = String(url.searchParams.get("order") || "").trim()

  if (!ORDER_ID_PATTERN.test(orderId)) return billingRedirect("tbc_missing_order")
  if (!isTbcCheckoutEnabled()) return billingRedirect("tbc_disabled")

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const next = `/api/tbc/boosts/return?order=${encodeURIComponent(orderId)}`
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, getSiteUrlEnv()))
    }

    const { data: ownedOrder, error } = await supabase
      .from("listing_boost_orders")
      .select("id")
      .eq("id", orderId)
      .eq("seller_id", user.id)
      .eq("payment_provider", "tbc_checkout")
      .maybeSingle()
    if (error || !ownedOrder) return billingRedirect("tbc_missing_order")

    const result = await syncBoostOrderFromTbcByOrderId(orderId, "return")
    const providerStatus = String(result?.payment?.status ?? ((result?.order as { provider_status?: string | null } | null)?.provider_status ?? ""))

    let flash = "tbc_pending"
    if (result?.order?.status === "active") flash = "tbc_activated"
    else if (providerStatus === "Succeeded" && result?.order?.status === "approved") flash = "tbc_success"
    else if (providerStatus === "WaitingConfirm") flash = "tbc_pending"
    else if (providerStatus === "Failed") flash = "tbc_failed"
    else if (providerStatus === "Returned") flash = "tbc_returned"
    else if (providerStatus === "PartialReturned") flash = "tbc_partially_returned"
    else if (providerStatus === "CancelPaymentProcessing") flash = "tbc_cancelled"
    else if (providerStatus === "Expired") flash = "tbc_expired"

    return billingRedirect(flash)
  } catch {
    return billingRedirect("tbc_error")
  }
}
