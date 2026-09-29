import type { SupabaseClient } from "@supabase/supabase-js"

export type AdminAgentSeverity = "critical" | "high" | "medium" | "low"
export type AdminAgentSignalKind =
  | "payment"
  | "moderation"
  | "support"
  | "store"
  | "system"

export type AdminAgentSignal = {
  id: string
  kind: AdminAgentSignalKind
  severity: AdminAgentSeverity
  title: string
  detail: string
  href: string
  entityId?: string
  ageMinutes?: number
}

export type AdminAgentSnapshot = {
  generatedAt: string
  activeListings: number
  suspendedUsers: number
  activeBoosts: number

  openListingReports: number
  openUserReports: number
  reviewingListingReports: number
  reviewingUserReports: number
  overdueReports24h: number

  openSupportTickets: number
  reviewingSupportTickets: number
  highPrioritySupportTickets: number
  overdueSupportTickets24h: number

  realLivePayments: number
  approvedPayments: number
  pendingPayments: number
  stalePendingPayments: number
  failedPayments: number
  returnedPayments: number
  validationPayments: number

  totalStores: number
  verifiedStores: number
  incompleteStores: number
  suspendedStores: number

  signals: AdminAgentSignal[]
}

const REPORT_OVERDUE_MINUTES = 24 * 60
const PAYMENT_STALE_MINUTES = 30
const SUPPORT_OVERDUE_MINUTES = 24 * 60

function ageMinutes(value: string, nowMs: number) {
  return Math.max(0, Math.floor((nowMs - new Date(value).getTime()) / 60_000))
}

function ageText(minutes: number) {
  if (minutes < 60) return `${minutes} წუთია`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} საათია`
  return `${Math.floor(hours / 24)} დღეა`
}

function severityRank(value: AdminAgentSeverity) {
  switch (value) {
    case "critical": return 4
    case "high": return 3
    case "medium": return 2
    case "low": return 1
  }
}

function storeIsComplete(profile: Record<string, unknown>) {
  return Boolean(
    String(profile.username ?? "").trim() &&
    String(profile.full_name ?? "").trim() &&
    String(profile.store_logo_url ?? "").trim() &&
    String(profile.store_phone ?? "").trim() &&
    String(profile.store_address ?? "").trim() &&
    String(profile.store_hours ?? "").trim(),
  )
}

export async function collectAdminAgentSnapshot(
  supabase: SupabaseClient,
): Promise<AdminAgentSnapshot> {
  const now = new Date()
  const nowIso = now.toISOString()
  const nowMs = now.getTime()
  const reportCutoff = new Date(nowMs - REPORT_OVERDUE_MINUTES * 60_000).toISOString()
  const supportCutoff = new Date(nowMs - SUPPORT_OVERDUE_MINUTES * 60_000).toISOString()
  const paymentCutoff = new Date(nowMs - PAYMENT_STALE_MINUTES * 60_000).toISOString()

  const [
    activeListingsResult,
    suspendedUsersResult,
    activeBoostsResult,

    openListingReportsResult,
    openUserReportsResult,
    reviewingListingReportsResult,
    reviewingUserReportsResult,
    overdueListingReportsResult,
    overdueUserReportsResult,

    openSupportResult,
    reviewingSupportResult,
    highSupportResult,
    overdueSupportResult,

    realLivePaymentsResult,
    approvedPaymentsResult,
    pendingPaymentsResult,
    stalePaymentsResult,
    failedPaymentsResult,
    returnedPaymentsResult,
    validationPaymentsResult,

    openListingReportRows,
    openUserReportRows,
    supportRows,
    stalePaymentRows,
    failedPaymentRows,
    storeRows,
  ] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_suspended", true),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("status", "active").gt("ends_at", nowIso),

    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]).lte("created_at", reportCutoff),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]).lte("created_at", reportCutoff),

    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("priority", "high").in("status", ["open", "reviewing"]),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]).lte("created_at", supportCutoff),

    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test"),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test").eq("status", "approved"),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test").eq("status", "pending"),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test").eq("status", "pending").lte("created_at", paymentCutoff),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test").in("status", ["declined", "expired", "failed"]),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test").eq("status", "reversed"),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").eq("purpose", "sandbox_test"),

    supabase.from("listing_reports").select("id, status, created_at").in("status", ["open", "reviewing"]).order("created_at", { ascending: true }).limit(20),
    supabase.from("user_reports").select("id, status, created_at").in("status", ["open", "reviewing"]).order("created_at", { ascending: true }).limit(20),
    supabase.from("support_tickets").select("id, category, status, priority, created_at").in("status", ["open", "reviewing"]).order("created_at", { ascending: true }).limit(20),
    supabase.from("flitt_payment_attempts").select("id, order_id, provider_payment_id, purpose, status, provider_status, callback_count, created_at").eq("mode", "live").neq("purpose", "sandbox_test").eq("status", "pending").lte("created_at", paymentCutoff).order("created_at", { ascending: true }).limit(20),
    supabase.from("flitt_payment_attempts").select("id, order_id, provider_payment_id, purpose, status, provider_status, callback_count, created_at").eq("mode", "live").neq("purpose", "sandbox_test").in("status", ["declined", "expired", "failed"]).order("created_at", { ascending: false }).limit(10),
    supabase.from("profiles").select("id, username, full_name, is_seller_verified, is_suspended, seller_type, store_logo_url, store_phone, store_address, store_hours").eq("seller_type", "store").limit(500),
  ])

  const stores = (storeRows.data ?? []) as Array<Record<string, unknown>>
  const totalStores = stores.length
  const verifiedStores = stores.filter((item) => item.is_seller_verified === true).length
  const suspendedStores = stores.filter((item) => item.is_suspended === true).length
  const incompleteStores = stores.filter((item) => !storeIsComplete(item)).length

  const signals: AdminAgentSignal[] = []

  for (const payment of stalePaymentRows.data ?? []) {
    const age = ageMinutes(String(payment.created_at), nowMs)
    signals.push({
      id: `payment-stale-${payment.id}`,
      kind: "payment",
      severity: age >= 120 ? "critical" : "high",
      title: "Flitt გადახდა დიდხანს არის pending",
      detail: `${ageText(age)} pending · provider: ${payment.provider_status || "უცნობი"} · callback: ${payment.callback_count ?? 0}`,
      href: "/admin/payments?status=pending",
      entityId: String(payment.provider_payment_id || payment.order_id || payment.id),
      ageMinutes: age,
    })
  }

  for (const payment of failedPaymentRows.data ?? []) {
    const age = ageMinutes(String(payment.created_at), nowMs)
    signals.push({
      id: `payment-failed-${payment.id}`,
      kind: "payment",
      severity: "high",
      title: "Flitt გადახდა საბოლოოდ ვერ დასრულდა",
      detail: `status: ${payment.status} · provider: ${payment.provider_status || "უცნობი"} · ${ageText(age)}`,
      href: "/admin/payments?status=failed",
      entityId: String(payment.provider_payment_id || payment.order_id || payment.id),
      ageMinutes: age,
    })
  }

  for (const report of openListingReportRows.data ?? []) {
    const age = ageMinutes(String(report.created_at), nowMs)
    if (age < REPORT_OVERDUE_MINUTES) continue
    signals.push({
      id: `listing-report-${report.id}`,
      kind: "moderation",
      severity: age >= 48 * 60 ? "high" : "medium",
      title: "განცხადების რეპორტი 24სთ+ რიგშია",
      detail: `${ageText(age)} · status: ${report.status}`,
      href: "/admin/reports?kind=listing&age=overdue",
      entityId: String(report.id),
      ageMinutes: age,
    })
  }

  for (const report of openUserReportRows.data ?? []) {
    const age = ageMinutes(String(report.created_at), nowMs)
    if (age < REPORT_OVERDUE_MINUTES) continue
    signals.push({
      id: `user-report-${report.id}`,
      kind: "moderation",
      severity: age >= 48 * 60 ? "high" : "medium",
      title: "მომხმარებლის რეპორტი 24სთ+ რიგშია",
      detail: `${ageText(age)} · status: ${report.status}`,
      href: "/admin/reports?kind=user&age=overdue",
      entityId: String(report.id),
      ageMinutes: age,
    })
  }

  for (const ticket of supportRows.data ?? []) {
    const age = ageMinutes(String(ticket.created_at), nowMs)
    const priority = String(ticket.priority ?? "normal")
    if (priority !== "high" && age < SUPPORT_OVERDUE_MINUTES) continue

    signals.push({
      id: `support-${ticket.id}`,
      kind: "support",
      severity: priority === "high" ? "high" : "medium",
      title: priority === "high"
        ? "მაღალი პრიორიტეტის Support ticket"
        : "Support ticket 24სთ+ რიგშია",
      detail: `კატეგორია: ${ticket.category || "other"} · status: ${ticket.status} · ${ageText(age)}`,
      href: priority === "high" ? "/admin/support?priority=high" : "/admin/support",
      entityId: String(ticket.id),
      ageMinutes: age,
    })
  }

  if (incompleteStores > 0) {
    signals.push({
      id: "stores-incomplete",
      kind: "store",
      severity: "low",
      title: "არასრულად შევსებული მაღაზიებია",
      detail: `${incompleteStores} / ${totalStores} მაღაზიას აკლია ძირითადი პროფილის ველები.`,
      href: "/admin/stores?status=incomplete",
    })
  }

  signals.sort((left, right) => {
    const severity = severityRank(right.severity) - severityRank(left.severity)
    if (severity !== 0) return severity
    return (right.ageMinutes ?? 0) - (left.ageMinutes ?? 0)
  })

  return {
    generatedAt: nowIso,
    activeListings: activeListingsResult.count ?? 0,
    suspendedUsers: suspendedUsersResult.count ?? 0,
    activeBoosts: activeBoostsResult.count ?? 0,

    openListingReports: openListingReportsResult.count ?? 0,
    openUserReports: openUserReportsResult.count ?? 0,
    reviewingListingReports: reviewingListingReportsResult.count ?? 0,
    reviewingUserReports: reviewingUserReportsResult.count ?? 0,
    overdueReports24h: (overdueListingReportsResult.count ?? 0) + (overdueUserReportsResult.count ?? 0),

    openSupportTickets: openSupportResult.count ?? 0,
    reviewingSupportTickets: reviewingSupportResult.count ?? 0,
    highPrioritySupportTickets: highSupportResult.count ?? 0,
    overdueSupportTickets24h: overdueSupportResult.count ?? 0,

    realLivePayments: realLivePaymentsResult.count ?? 0,
    approvedPayments: approvedPaymentsResult.count ?? 0,
    pendingPayments: pendingPaymentsResult.count ?? 0,
    stalePendingPayments: stalePaymentsResult.count ?? 0,
    failedPayments: failedPaymentsResult.count ?? 0,
    returnedPayments: returnedPaymentsResult.count ?? 0,
    validationPayments: validationPaymentsResult.count ?? 0,

    totalStores,
    verifiedStores,
    incompleteStores,
    suspendedStores,

    signals: signals.slice(0, 20),
  }
}

export function buildFallbackAdminSummary(snapshot: AdminAgentSnapshot) {
  const openReports = snapshot.openListingReports + snapshot.openUserReports
  const reviewingReports = snapshot.reviewingListingReports + snapshot.reviewingUserReports
  const priorities: string[] = []

  if (snapshot.stalePendingPayments > 0) {
    priorities.push(`Payments: ${snapshot.stalePendingPayments} რეალური Flitt გადახდა 30 წუთზე მეტია pending მდგომარეობაშია.`)
  }
  if (snapshot.failedPayments > 0) {
    priorities.push(`Payments: ${snapshot.failedPayments} რეალური Flitt გადახდა წარუმატებელ საბოლოო სტატუსშია.`)
  }
  if (snapshot.highPrioritySupportTickets > 0) {
    priorities.push(`Support: ${snapshot.highPrioritySupportTickets} მაღალი პრიორიტეტის ticket საჭიროებს ყურადღებას.`)
  }
  if (snapshot.overdueReports24h > 0) {
    priorities.push(`Moderation: ${snapshot.overdueReports24h} რეპორტი 24 საათზე მეტია რიგშია.`)
  }
  if (snapshot.overdueSupportTickets24h > 0) {
    priorities.push(`Support: ${snapshot.overdueSupportTickets24h} ticket 24 საათზე მეტია ღია/დამუშავებაშია.`)
  }
  if (openReports > 0) priorities.push(`Moderation: სულ ${openReports} ღია რეპორტია.`)
  if (reviewingReports > 0) priorities.push(`Moderation: ${reviewingReports} რეპორტი უკვე დამუშავებაშია.`)
  if (snapshot.incompleteStores > 0) priorities.push(`Stores: ${snapshot.incompleteStores} მაღაზია არასრულადაა შევსებული.`)
  if (priorities.length === 0) priorities.push("ამ snapshot-ში მაღალი პრიორიტეტის ოპერაციული პრობლემა არ ჩანს.")

  return [
    "SamoSell Admin Copilot — read-only ანგარიში",
    `აქტიური განცხადებები: ${snapshot.activeListings}; აქტიური VIP: ${snapshot.activeBoosts}.`,
    `Flitt რეალური LIVE: ${snapshot.realLivePayments}; approved: ${snapshot.approvedPayments}; pending: ${snapshot.pendingPayments}; validation: ${snapshot.validationPayments}.`,
    `Support: ღია ${snapshot.openSupportTickets}; დამუშავებაში ${snapshot.reviewingSupportTickets}.`,
    `მაღაზიები: ${snapshot.totalStores}; verified: ${snapshot.verifiedStores}; არასრული: ${snapshot.incompleteStores}.`,
    "",
    "პრიორიტეტები:",
    ...priorities.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Phase 1 მხოლოდ კითხულობს მონაცემებს და ავტომატურად არაფერს ცვლის.",
  ].join("\n")
}
