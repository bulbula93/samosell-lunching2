import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { getTbcCheckoutReadiness } from "@/lib/tbc"

export type ReadinessCheck = { key: string; label: string; ok: boolean; detail: string }

export async function getTbcLaunchReadinessChecks(): Promise<ReadinessCheck[]> {
  const env = getTbcCheckoutReadiness()
  const supabase = createAdminClient()
  const [orders, events, refunds, products] = await Promise.all([
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }),
    supabase.from("listing_boost_order_events").select("id", { count: "exact", head: true }),
    supabase.from("listing_boost_refund_requests").select("id", { count: "exact", head: true }),
    supabase.from("listing_boost_products").select("id", { count: "exact", head: true }).eq("is_active", true),
  ])

  const databaseReady = !orders.error && !events.error && !refunds.error
  let callbackReachable = false
  try {
    const response = await fetch(env.callbackUrl, { method: "GET", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(5_000) })
    callbackReachable = response.status === 405
  } catch { /* The readiness UI reports an unverified route instead of guessing. */ }
  return [
    { key: "feature_flag", label: "TBC_CHECKOUT_ENABLED", ok: env.featureFlagEnabled, detail: env.featureFlagEnabled ? "ჩართულია" : "გამორთულია — უსაფრთხო მოსამზადებელი რეჟიმი" },
    { key: "api_key", label: "TBC API key", ok: env.apiKeyPresent, detail: env.apiKeyPresent ? "არსებობს" : "არ არის დამატებული" },
    { key: "client_id", label: "TBC Client ID", ok: env.clientIdPresent, detail: env.clientIdPresent ? "არსებობს" : "არ არის დამატებული" },
    { key: "client_secret", label: "TBC Client Secret", ok: env.clientSecretPresent, detail: env.clientSecretPresent ? "არსებობს" : "არ არის დამატებული" },
    { key: "site_url", label: "SITE_URL", ok: env.siteUrlIsProduction, detail: env.siteUrl },
    { key: "callback", label: "Callback route", ok: callbackReachable, detail: callbackReachable ? env.callbackUrl : "მარშრუტის ხელმისაწვდომობა ვერ დადასტურდა" },
    { key: "database", label: "Payment tables", ok: databaseReady, detail: databaseReady ? "orders, events და refunds ხელმისაწვდომია" : "ბაზის migration გადასამოწმებელია" },
    { key: "products", label: "Active boost products", ok: !products.error && (products.count ?? 0) > 0, detail: `${products.count ?? 0} აქტიური პროდუქტი` },
    { key: "reconciliation", label: "Manual reconciliation", ok: databaseReady, detail: "ადმინისა და seller-ის ავტორიზებული გადამოწმება მზადაა" },
  ]
}
