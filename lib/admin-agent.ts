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
  ] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_suspended", true),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).in("status", ["pending_payment", "under_review", "approved"]),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("status", "active").gt("ends_at", nowIso),
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
  }
}

export function buildFallbackAdminSummary(snapshot: AdminAgentSnapshot) {
  const openReports = snapshot.openListingReports + snapshot.openUserReports
  const reviewingReports = snapshot.reviewingListingReports + snapshot.reviewingUserReports
  const priorities: string[] = []

  if (openReports > 0) priorities.push(`მოდერაცია: ${openReports} ღია რეპორტია გადასახედი.`)
  if (reviewingReports > 0) priorities.push(`მოდერაცია: ${reviewingReports} რეპორტი უკვე დამუშავებაშია.`)
  if (snapshot.pendingBoosts > 0) priorities.push(`VIP: ${snapshot.pendingBoosts} მოთხოვნა ელოდება დამუშავებას.`)
  if (snapshot.suspendedUsers > 0) priorities.push(`Trust & Safety: ${snapshot.suspendedUsers} მომხმარებელი შეზღუდულია.`)
  if (priorities.length === 0) priorities.push("კრიტიკული admin queue ამ snapshot-ში არ ჩანს.")

  return [
    `აქტიური განცხადებები: ${snapshot.activeListings}.`,
    `აქტიური VIP: ${snapshot.activeBoosts}.`,
    ...priorities,
    "ეს რეჟიმი მხოლოდ კითხულობს მონაცემებს და ავტომატურად არაფერს ცვლის.",
  ].join("\n")
}
