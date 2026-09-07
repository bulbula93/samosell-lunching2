import type { SupabaseClient } from "@supabase/supabase-js"

export type AdminAgentSnapshot = {
  generatedAt: string
  activeListings: number
  openListingReports: number
  openUserReports: number
  reviewingListingReports: number
  reviewingUserReports: number
  suspendedUsers: number
  pendingBoosts: number
  activeBoosts: number
  failedPayments: number
  returnedPayments: number
  openRefundRequests: number
  stalePendingPayments: number
}

export async function collectAdminAgentSnapshot(supabase: SupabaseClient): Promise<AdminAgentSnapshot> {
  const nowIso = new Date().toISOString()
  const [
    { count: activeListings },
    { count: openListingReports },
    { count: openUserReports },
    { count: reviewingListingReports },
    { count: reviewingUserReports },
    { count: suspendedUsers },
    { count: pendingBoosts },
    { count: activeBoosts },
    { count: failedPayments },
    { count: returnedPayments },
    { count: openRefundRequests },
    { count: stalePendingPayments },
  ] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_suspended", true),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).in("status", ["pending_payment", "under_review", "approved"]),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("status", "active").gt("ends_at", nowIso),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("provider_status", "Failed"),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).in("provider_status", ["Returned", "PartialReturned"]),
    supabase.from("listing_boost_refund_requests").select("id", { count: "exact", head: true }).in("status", ["requested", "under_review", "approved", "provider_processing"]),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).in("status", ["pending_payment", "under_review", "approved"]).lt("updated_at", new Date(Date.now() - 30 * 60 * 1000).toISOString()),
  ])

  return {
    generatedAt: nowIso,
    activeListings: activeListings ?? 0,
    openListingReports: openListingReports ?? 0,
    openUserReports: openUserReports ?? 0,
    reviewingListingReports: reviewingListingReports ?? 0,
    reviewingUserReports: reviewingUserReports ?? 0,
    suspendedUsers: suspendedUsers ?? 0,
    pendingBoosts: pendingBoosts ?? 0,
    activeBoosts: activeBoosts ?? 0,
    failedPayments: failedPayments ?? 0,
    returnedPayments: returnedPayments ?? 0,
    openRefundRequests: openRefundRequests ?? 0,
    stalePendingPayments: stalePendingPayments ?? 0,
  }
}

export function buildFallbackAdminSummary(snapshot: AdminAgentSnapshot) {
  const openReports = snapshot.openListingReports + snapshot.openUserReports
  const reviewingReports = snapshot.reviewingListingReports + snapshot.reviewingUserReports
  const priorities: string[] = []

  if (openReports > 0) priorities.push(`მოდერაცია: ${openReports} ღია რეპორტია გადასახედი.`)
  if (reviewingReports > 0) priorities.push(`მოდერაცია: ${reviewingReports} რეპორტი უკვე დამუშავებაშია.`)
  if (snapshot.pendingBoosts > 0) priorities.push(`VIP: ${snapshot.pendingBoosts} მოთხოვნა ელოდება დამუშავებას.`)
  if (snapshot.stalePendingPayments > 0) priorities.push(`Payments: ${snapshot.stalePendingPayments} გადახდა 30 წუთზე მეტია მოლოდინშია.`)
  if (snapshot.openRefundRequests > 0) priorities.push(`Refunds: ${snapshot.openRefundRequests} მოთხოვნა ელოდება განხილვას.`)
  if (snapshot.suspendedUsers > 0) priorities.push(`Trust & Safety: ${snapshot.suspendedUsers} მომხმარებელი შეზღუდულია.`)
  if (priorities.length === 0) priorities.push("კრიტიკული admin queue ამ snapshot-ში არ ჩანს.")

  return [
    `აქტიური განცხადებები: ${snapshot.activeListings}.`,
    `აქტიური VIP: ${snapshot.activeBoosts}.`,
    `წარუმატებელი გადახდები: ${snapshot.failedPayments}; დაბრუნებული: ${snapshot.returnedPayments}.`,
    ...priorities,
    "ეს რეჟიმი მხოლოდ კითხულობს მონაცემებს და ავტომატურად არაფერს ცვლის.",
  ].join("\n")
}
