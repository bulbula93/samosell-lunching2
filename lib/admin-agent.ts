import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getFlittReadiness } from "@/lib/flitt"

const MODERATION_OVERDUE_HOURS = 24
const SUPPORT_OVERDUE_HOURS = 24
const STALE_PAYMENT_MINUTES = 30
const QUEUE_LIMIT = 8

export type AdminAgentSeverity = "critical" | "warning" | "info"
export type AdminAgentSignal = {
  id: string
  area: "payments" | "moderation" | "support" | "ads" | "stores" | "system" | "vip"
  severity: AdminAgentSeverity
  title: string
  detail: string
  href: string
  count: number
}
export type AdminAgentPaymentQueueItem = {
  id: string
  orderId: string
  purpose: string
  status: string
  providerStatus: string | null
  callbacks: number
  ageMinutes: number
  stale: boolean
  href: string
}
export type AdminAgentModerationQueueItem = {
  id: string
  kind: "listing" | "user" | "story"
  status: string
  ageHours: number
  overdue: boolean
  href: string
}
export type AdminAgentSupportQueueItem = {
  id: string
  category: string
  status: string
  priority: string
  ageHours: number
  overdue: boolean
  href: string
}

export type AdminAgentSnapshot = {
  generatedAt: string
  activeListings: number
  storeCount: number
  incompleteStores: number
  suspendedUsers: number
  openListingReports: number
  openUserReports: number
  openStoryReports: number
  reviewingListingReports: number
  reviewingUserReports: number
  reviewingStoryReports: number
  overdueReports: number
  openSupportTickets: number
  reviewingSupportTickets: number
  highPrioritySupportTickets: number
  overdueSupportTickets: number
  pendingBoosts: number
  activeBoosts: number
  realPaymentsTotal: number
  approvedPayments: number
  pendingPayments: number
  stalePendingPayments: number
  failedPayments: number
  returnedPayments: number
  validationPayments: number
  pendingAds: number
  failedAdRefunds: number
  system: {
    flittProductionReady: boolean
    transactionalEmailReady: boolean
    adminActivityEmailReady: boolean
    aiConfigured: boolean
  }
  dataHealth: {
    ok: boolean
    failedSections: string[]
  }
  signals: AdminAgentSignal[]
  queues: {
    payments: AdminAgentPaymentQueueItem[]
    moderation: AdminAgentModerationQueueItem[]
    support: AdminAgentSupportQueueItem[]
  }
}

type CountResponse = {
  count: number | null
  error: unknown
}
type DataResponse<T> = {
  data: T[] | null
  error: unknown
}

function countOf(response: CountResponse) {
  return response.count ?? 0
}
function ageMinutes(createdAt: string, nowMs: number) {
  const value = new Date(createdAt).getTime()
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor((nowMs - value) / 60_000))
}
function ageHours(createdAt: string, nowMs: number) {
  return Math.floor(ageMinutes(createdAt, nowMs) / 60)
}
function hasValue(value: unknown) {
  return Boolean(String(value ?? "").trim())
}

function getSystemReadiness() {
  let flittProductionReady = false
  try {
    const flitt = getFlittReadiness()
    flittProductionReady =
      flitt.mode === "live" &&
      Boolean(flitt.liveEnabled) &&
      Boolean(flitt.productionDeployment)
  } catch {
    flittProductionReady = false
  }

  return {
    flittProductionReady,
    transactionalEmailReady:
      Boolean(String(process.env.RESEND_API_KEY ?? "").trim()) &&
      Boolean(
        String(
          process.env.NOTIFICATION_EMAIL_FROM ??
            process.env.EMAIL_FROM ??
            "",
        ).trim(),
      ),
    adminActivityEmailReady: Boolean(
      String(process.env.ADMIN_ACTIVITY_EMAIL ?? "").trim(),
    ),
    aiConfigured: Boolean(String(process.env.OPENAI_API_KEY ?? "").trim()),
  }
}

function buildSignals(snapshot: Omit<AdminAgentSnapshot, "signals">) {
  const signals: AdminAgentSignal[] = []
  const add = (
    id: string,
    area: AdminAgentSignal["area"],
    severity: AdminAgentSeverity,
    title: string,
    detail: string,
    href: string,
    count: number,
  ) => signals.push({ id, area, severity, title, detail, href, count })

  if (!snapshot.dataHealth.ok) {
    add(
      "system-data-health",
      "system",
      "critical",
      "Admin მონაცემების ნაწილი ვერ ჩაიტვირთა",
      `${snapshot.dataHealth.failedSections.length} read-only data source ვერ პასუხობს. AI-ის ანალიზი ნაწილობრივი შეიძლება იყოს.`,
      "/admin/system",
      snapshot.dataHealth.failedSections.length,
    )
  }
  if (!snapshot.system.flittProductionReady) {
    add("system-flitt", "system", "critical", "Flitt production readiness შესამოწმებელია", "Production payment configuration სრულ READY მდგომარეობაში არ ჩანს.", "/admin/system", 1)
  }
  if (snapshot.stalePendingPayments > 0) {
    add("payments-stale", "payments", "critical", "30წთ+ pending რეალური გადახდები", `${snapshot.stalePendingPayments} VIP/რეკლამის Flitt გადახდა 30 წუთზე მეტია საბოლოო provider სტატუსს ელოდება.`, "/admin/payments?status=pending", snapshot.stalePendingPayments)
  }
  if (snapshot.failedPayments > 0) {
    add("payments-failed", "payments", "warning", "წარუმატებელი Flitt გადახდები", `${snapshot.failedPayments} რეალური LIVE ტრანზაქცია declined/expired/failed მდგომარეობაშია.`, "/admin/payments?status=failed", snapshot.failedPayments)
  }
  if (snapshot.failedAdRefunds > 0) {
    add("ads-refund-failed", "ads", "critical", "რეკლამის refund შეცდომები", `${snapshot.failedAdRefunds} რეკლამის refund პროცესმა საბოლოო წარმატებულ მდგომარეობას ვერ მიაღწია.`, "/admin/ads", snapshot.failedAdRefunds)
  }
  if (snapshot.overdueReports > 0) {
    add("moderation-overdue", "moderation", "warning", "24სთ+ moderation backlog", `${snapshot.overdueReports} report 24 საათზე ძველია და ჯერ open/reviewing მდგომარეობაშია.`, "/admin/reports?status=all&age=overdue&sort=oldest", snapshot.overdueReports)
  }
  if (snapshot.highPrioritySupportTickets > 0) {
    add("support-high-priority", "support", "critical", "მაღალი პრიორიტეტის Support", `${snapshot.highPrioritySupportTickets} მაღალი პრიორიტეტის ticket აქტიურ queue-შია.`, "/admin/support?priority=high", snapshot.highPrioritySupportTickets)
  }
  if (snapshot.overdueSupportTickets > 0) {
    add("support-overdue", "support", "warning", "24სთ+ Support backlog", `${snapshot.overdueSupportTickets} Support ticket 24 საათზე ძველია და ჯერ დახურული არ არის.`, "/admin/support", snapshot.overdueSupportTickets)
  }
  if (snapshot.pendingAds > 0) {
    add("ads-review", "ads", "warning", "რეკლამები review-ს ელოდება", `${snapshot.pendingAds} სარეკლამო მასალა pending review მდგომარეობაშია.`, "/admin/ads", snapshot.pendingAds)
  }
  if (snapshot.pendingBoosts > 0) {
    add("vip-pending", "vip", "info", "VIP მოთხოვნები დამუშავებაშია", `${snapshot.pendingBoosts} VIP/Boost მოთხოვნა ჯერ საბოლოო active მდგომარეობაში არ არის.`, "/admin/boosts", snapshot.pendingBoosts)
  }
  if (snapshot.incompleteStores > 0) {
    add("stores-incomplete", "stores", "info", "არასრულად შევსებული მაღაზიები", `${snapshot.incompleteStores} store profile-ს ძირითადი საჯარო ინფორმაცია აკლია.`, "/admin/stores?filter=incomplete", snapshot.incompleteStores)
  }
  if (!snapshot.system.transactionalEmailReady) {
    add("system-email", "system", "warning", "Transactional email configuration შესამოწმებელია", "Resend/sender configuration სრულ READY მდგომარეობაში არ ჩანს.", "/admin/system", 1)
  }

  const rank: Record<AdminAgentSeverity, number> = { critical: 0, warning: 1, info: 2 }
  return signals.sort((a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count)
}

export async function collectAdminAgentSnapshot(
  supabase: SupabaseClient,
): Promise<AdminAgentSnapshot> {
  const now = new Date()
  const nowMs = now.getTime()
  const nowIso = now.toISOString()
  const moderationCutoff = new Date(nowMs - MODERATION_OVERDUE_HOURS * 3_600_000).toISOString()
  const supportCutoff = new Date(nowMs - SUPPORT_OVERDUE_HOURS * 3_600_000).toISOString()
  const stalePaymentCutoff = new Date(nowMs - STALE_PAYMENT_MINUTES * 60_000).toISOString()

  const [
    activeListings,
    openListingReports,
    openUserReports,
    openStoryReports,
    reviewingListingReports,
    reviewingUserReports,
    reviewingStoryReports,
    overdueListingReports,
    overdueUserReports,
    overdueStoryReports,
    suspendedUsers,
    storeCount,
    storeProfiles,
    pendingBoosts,
    activeBoosts,
    realPaymentsTotal,
    approvedPayments,
    pendingPayments,
    stalePendingPayments,
    failedPayments,
    returnedPayments,
    validationPayments,
    openSupportTickets,
    reviewingSupportTickets,
    highPrioritySupportTickets,
    overdueSupportTickets,
    pendingAds,
    failedAdRefunds,
    paymentQueue,
    listingReportQueue,
    userReportQueue,
    storyReportQueue,
    supportQueue,
  ] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("story_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("story_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]).lte("created_at", moderationCutoff),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]).lte("created_at", moderationCutoff),
    supabase.from("story_reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]).lte("created_at", moderationCutoff),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_suspended", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("seller_type", "store"),
    supabase.from("profiles").select("id, username, full_name, store_logo_url, store_phone, store_address, store_hours").eq("seller_type", "store").limit(500),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).or("payment_provider.neq.tbc_checkout,payment_provider.is.null").in("status", ["pending_payment", "under_review", "approved"]),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("status", "active").gt("ends_at", nowIso),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test"),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test").eq("status", "approved"),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test").eq("status", "pending"),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test").eq("status", "pending").lte("created_at", stalePaymentCutoff),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test").in("status", ["declined", "expired", "failed"]),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").neq("purpose", "sandbox_test").eq("status", "reversed"),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").eq("purpose", "sandbox_test"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("priority", "high").in("status", ["open", "reviewing"]),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]).lte("created_at", supportCutoff),
    supabase.from("ads").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
    supabase.from("ad_orders").select("id", { count: "exact", head: true }).eq("refund_status", "failed"),
    supabase.from("flitt_payment_attempts").select("id, order_id, purpose, status, provider_status, callback_count, created_at, updated_at").eq("mode", "live").neq("purpose", "sandbox_test").eq("status", "pending").order("created_at", { ascending: true }).limit(QUEUE_LIMIT),
    supabase.from("listing_reports").select("id, status, created_at").in("status", ["open", "reviewing"]).order("created_at", { ascending: true }).limit(QUEUE_LIMIT),
    supabase.from("user_reports").select("id, status, created_at").in("status", ["open", "reviewing"]).order("created_at", { ascending: true }).limit(QUEUE_LIMIT),
    supabase.from("story_reports").select("id, status, created_at").in("status", ["open", "reviewing"]).order("created_at", { ascending: true }).limit(QUEUE_LIMIT),
    supabase.from("support_tickets").select("id, category, status, priority, created_at, updated_at").in("status", ["open", "reviewing"]).order("created_at", { ascending: true }).limit(QUEUE_LIMIT),
  ])

  const failedSections = [
    ["listings", activeListings],
    ["listing_reports", openListingReports],
    ["user_reports", openUserReports],
    ["story_reports", openStoryReports],
    ["profiles", suspendedUsers],
    ["stores", storeProfiles],
    ["vip", pendingBoosts],
    ["payments", realPaymentsTotal],
    ["support", openSupportTickets],
    ["ads", pendingAds],
    ["payment_queue", paymentQueue],
    ["moderation_queue", listingReportQueue],
    ["support_queue", supportQueue],
  ]
    .filter(([, response]) => Boolean((response as { error: unknown }).error))
    .map(([label]) => String(label))

  const storeRows = ((storeProfiles as DataResponse<{
    id: string
    username: string | null
    full_name: string | null
    store_logo_url: string | null
    store_phone: string | null
    store_address: string | null
    store_hours: string | null
  }>).data ?? [])
  const incompleteStores = storeRows.filter((profile) =>
    [profile.username, profile.full_name, profile.store_logo_url, profile.store_phone, profile.store_address, profile.store_hours]
      .some((value) => !hasValue(value)),
  ).length

  const paymentRows = ((paymentQueue as DataResponse<{
    id: string
    order_id: string
    purpose: string
    status: string
    provider_status: string | null
    callback_count: number | null
    created_at: string
    updated_at: string
  }>).data ?? [])

  const mapReports = (
    kind: AdminAgentModerationQueueItem["kind"],
    response: DataResponse<{ id: string; status: string; created_at: string }>,
  ) => (response.data ?? []).map((row) => {
    const hours = ageHours(row.created_at, nowMs)
    return {
      id: row.id,
      kind,
      status: row.status,
      ageHours: hours,
      overdue: hours >= MODERATION_OVERDUE_HOURS,
      href: `/admin/reports?q=${encodeURIComponent(row.id)}`,
    }
  })

  const moderationQueue = [
    ...mapReports("listing", listingReportQueue as DataResponse<{ id: string; status: string; created_at: string }>),
    ...mapReports("user", userReportQueue as DataResponse<{ id: string; status: string; created_at: string }>),
    ...mapReports("story", storyReportQueue as DataResponse<{ id: string; status: string; created_at: string }>),
  ]
    .sort((a, b) => b.ageHours - a.ageHours)
    .slice(0, QUEUE_LIMIT)

  const supportRows = ((supportQueue as DataResponse<{
    id: string
    category: string
    status: string
    priority: string
    created_at: string
    updated_at: string
  }>).data ?? [])

  const base: Omit<AdminAgentSnapshot, "signals"> = {
    generatedAt: nowIso,
    activeListings: countOf(activeListings as CountResponse),
    storeCount: countOf(storeCount as CountResponse),
    incompleteStores,
    suspendedUsers: countOf(suspendedUsers as CountResponse),
    openListingReports: countOf(openListingReports as CountResponse),
    openUserReports: countOf(openUserReports as CountResponse),
    openStoryReports: countOf(openStoryReports as CountResponse),
    reviewingListingReports: countOf(reviewingListingReports as CountResponse),
    reviewingUserReports: countOf(reviewingUserReports as CountResponse),
    reviewingStoryReports: countOf(reviewingStoryReports as CountResponse),
    overdueReports:
      countOf(overdueListingReports as CountResponse) +
      countOf(overdueUserReports as CountResponse) +
      countOf(overdueStoryReports as CountResponse),
    openSupportTickets: countOf(openSupportTickets as CountResponse),
    reviewingSupportTickets: countOf(reviewingSupportTickets as CountResponse),
    highPrioritySupportTickets: countOf(highPrioritySupportTickets as CountResponse),
    overdueSupportTickets: countOf(overdueSupportTickets as CountResponse),
    pendingBoosts: countOf(pendingBoosts as CountResponse),
    activeBoosts: countOf(activeBoosts as CountResponse),
    realPaymentsTotal: countOf(realPaymentsTotal as CountResponse),
    approvedPayments: countOf(approvedPayments as CountResponse),
    pendingPayments: countOf(pendingPayments as CountResponse),
    stalePendingPayments: countOf(stalePendingPayments as CountResponse),
    failedPayments: countOf(failedPayments as CountResponse),
    returnedPayments: countOf(returnedPayments as CountResponse),
    validationPayments: countOf(validationPayments as CountResponse),
    pendingAds: countOf(pendingAds as CountResponse),
    failedAdRefunds: countOf(failedAdRefunds as CountResponse),
    system: getSystemReadiness(),
    dataHealth: { ok: failedSections.length === 0, failedSections },
    queues: {
      payments: paymentRows.map((row) => {
        const minutes = ageMinutes(row.created_at, nowMs)
        return {
          id: row.id,
          orderId: row.order_id,
          purpose: row.purpose,
          status: row.status,
          providerStatus: row.provider_status,
          callbacks: row.callback_count ?? 0,
          ageMinutes: minutes,
          stale: minutes >= STALE_PAYMENT_MINUTES,
          href: `/admin/payments?q=${encodeURIComponent(row.order_id)}`,
        }
      }),
      moderation: moderationQueue,
      support: supportRows.map((row) => {
        const hours = ageHours(row.created_at, nowMs)
        return {
          id: row.id,
          category: row.category,
          status: row.status,
          priority: row.priority,
          ageHours: hours,
          overdue: hours >= SUPPORT_OVERDUE_HOURS,
          href: `/admin/support?q=${encodeURIComponent(row.id)}`,
        }
      }),
    },
  }

  return { ...base, signals: buildSignals(base) }
}

export function buildAdminAgentModelContext(snapshot: AdminAgentSnapshot) {
  return {
    generatedAt: snapshot.generatedAt,
    metrics: {
      listings: { active: snapshot.activeListings },
      stores: {
        total: snapshot.storeCount,
        incomplete: snapshot.incompleteStores,
        suspendedUsers: snapshot.suspendedUsers,
      },
      moderation: {
        open: snapshot.openListingReports + snapshot.openUserReports + snapshot.openStoryReports,
        reviewing: snapshot.reviewingListingReports + snapshot.reviewingUserReports + snapshot.reviewingStoryReports,
        overdue24h: snapshot.overdueReports,
      },
      support: {
        open: snapshot.openSupportTickets,
        reviewing: snapshot.reviewingSupportTickets,
        highPriority: snapshot.highPrioritySupportTickets,
        overdue24h: snapshot.overdueSupportTickets,
      },
      vip: { pending: snapshot.pendingBoosts, active: snapshot.activeBoosts },
      payments: {
        realLive: snapshot.realPaymentsTotal,
        approved: snapshot.approvedPayments,
        pending: snapshot.pendingPayments,
        stale30m: snapshot.stalePendingPayments,
        failed: snapshot.failedPayments,
        returned: snapshot.returnedPayments,
        validation: snapshot.validationPayments,
      },
      ads: {
        pendingReview: snapshot.pendingAds,
        refundFailures: snapshot.failedAdRefunds,
      },
    },
    system: snapshot.system,
    dataHealth: snapshot.dataHealth,
    signals: snapshot.signals,
    queues: snapshot.queues,
    privacyNote:
      "Context intentionally excludes emails, support message bodies, report details, profile names, phone numbers, addresses, and secrets.",
  }
}

function compactSignalLines(snapshot: AdminAgentSnapshot) {
  if (!snapshot.signals.length) return ["• კრიტიკული operational signal ამ მომენტში არ ჩანს."]
  return snapshot.signals.slice(0, 6).map((signal) => {
    const marker = signal.severity === "critical" ? "🔴" : signal.severity === "warning" ? "🟠" : "🔵"
    return `${marker} ${signal.title}: ${signal.detail}`
  })
}

export function buildFallbackAdminSummary(snapshot: AdminAgentSnapshot) {
  const openReports = snapshot.openListingReports + snapshot.openUserReports + snapshot.openStoryReports
  const reviewingReports = snapshot.reviewingListingReports + snapshot.reviewingUserReports + snapshot.reviewingStoryReports
  return [
    "SamoSell Admin Copilot — მიმდინარე read-only snapshot",
    "",
    `განცხადებები: ${snapshot.activeListings} აქტიური.`,
    `მოდერაცია: ${openReports} open, ${reviewingReports} reviewing, ${snapshot.overdueReports} არის 24სთ+ backlog.`,
    `Support: ${snapshot.openSupportTickets} open, ${snapshot.reviewingSupportTickets} reviewing, ${snapshot.highPrioritySupportTickets} მაღალი პრიორიტეტი.`,
    `Payments: ${snapshot.realPaymentsTotal} რეალური LIVE; ${snapshot.pendingPayments} pending; ${snapshot.stalePendingPayments} არის 30წთ+ stale; ${snapshot.failedPayments} failed.`,
    `VIP: ${snapshot.activeBoosts} active; ${snapshot.pendingBoosts} pending.`,
    `Ads: ${snapshot.pendingAds} pending review; ${snapshot.failedAdRefunds} refund failure.`,
    "",
    "პრიორიტეტები:",
    ...compactSignalLines(snapshot),
    "",
    "ეს ვერსია მხოლოდ კითხულობს მონაცემებს და თვითონ არაფერს ცვლის.",
  ].join("\n")
}

export function buildFallbackAdminReply(snapshot: AdminAgentSnapshot, message: string) {
  const query = message.toLocaleLowerCase("ka-GE")

  if (query.includes("payment") || query.includes("გადახდ") || query.includes("flitt")) {
    const queue = snapshot.queues.payments.length
      ? snapshot.queues.payments.map((item) =>
          `• ${item.orderId}: ${item.providerStatus || item.status}, ${item.ageMinutes} წუთი, callbacks=${item.callbacks}${item.stale ? " — STALE" : ""}`,
        ).join("\n")
      : "• pending რეალური payment queue ცარიელია."
    return [
      `რეალური LIVE გადახდები: ${snapshot.realPaymentsTotal}.`,
      `Approved: ${snapshot.approvedPayments}; pending: ${snapshot.pendingPayments}; 30წთ+ stale: ${snapshot.stalePendingPayments}; failed: ${snapshot.failedPayments}; returned: ${snapshot.returnedPayments}.`,
      `Validation ჩანაწერები ცალკეა: ${snapshot.validationPayments}.`,
      "",
      "Pending queue:",
      queue,
      "",
      "შემდეგი ნაბიჯი: stale ჩანაწერზე გახსენი Admin → Payments და გამოიყენე Flitt provider status check. Copilot თვითონ არაფერს ცვლის.",
    ].join("\n")
  }

  if (query.includes("report") || query.includes("მოდერ") || query.includes("რეპორტ")) {
    const open = snapshot.openListingReports + snapshot.openUserReports + snapshot.openStoryReports
    const reviewing = snapshot.reviewingListingReports + snapshot.reviewingUserReports + snapshot.reviewingStoryReports
    return [
      `მოდერაცია: ${open} open, ${reviewing} reviewing, ${snapshot.overdueReports} არის 24სთ+ backlog.`,
      snapshot.queues.moderation.length
        ? `ყველაზე ძველი queue item: ${snapshot.queues.moderation[0].kind} report ${snapshot.queues.moderation[0].id}, ასაკი ${snapshot.queues.moderation[0].ageHours}სთ.`
        : "აქტიური moderation queue ცარიელია.",
      "რეკომენდაცია: ჯერ 24სთ+ ჩანაწერები, შემდეგ ახალი open report-ები.",
    ].join("\n")
  }

  if (query.includes("support") || query.includes("მხარდაჭ") || query.includes("ticket")) {
    return [
      `Support: ${snapshot.openSupportTickets} open, ${snapshot.reviewingSupportTickets} reviewing.`,
      `High priority: ${snapshot.highPrioritySupportTickets}; 24სთ+ backlog: ${snapshot.overdueSupportTickets}.`,
      "Copilot context-ში message body, email და სხვა private content არ იგზავნება.",
      snapshot.highPrioritySupportTickets > 0
        ? "რეკომენდაცია: ჯერ მაღალი პრიორიტეტის ticket-ები გახსენი /admin/support?priority=high-ზე."
        : "მაღალი პრიორიტეტის აქტიური ticket ამ snapshot-ში არ ჩანს.",
    ].join("\n")
  }

  if (query.includes("store") || query.includes("მაღაზი")) {
    return [
      `მაღაზიები: ${snapshot.storeCount}.`,
      `არასრულად შევსებული: ${snapshot.incompleteStores}.`,
      `შეზღუდული მომხმარებლები მთლიანად: ${snapshot.suspendedUsers}.`,
      "რეკომენდაცია: incomplete store პროფილები გადაამოწმე /admin/stores?filter=incomplete-ზე.",
    ].join("\n")
  }

  return buildFallbackAdminSummary(snapshot)
}
