import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

const ACTIVE_SELLER_LISTING_THRESHOLD = 3
const TARGET_ACTIVE_LISTINGS = 1000
const TARGET_WINDOW_DAYS = 30
const MAX_ROWS = 5000

export type GrowthSignalSeverity = "critical" | "warning" | "info"

export type GrowthSignal = {
  id: string
  severity: GrowthSignalSeverity
  title: string
  detail: string
  href: string
}

export type GrowthSnapshot = {
  generatedAt: string
  activeListings: number
  listings24h: number
  listings7d: number
  newProfiles24h: number
  newProfiles7d: number
  chats7d: number
  sold7d: number
  sellersWithActiveListings: number
  activatedSellers: number
  warmSellers: number
  singleListingSellers: number
  activationRatePct: number
  dailyListingTarget: number
  gapToTarget: number
  aiConfigured: boolean
  dataHealth: {
    ok: boolean
    failedSections: string[]
  }
  signals: GrowthSignal[]
}

type CountResponse = {
  count: number | null
  error: unknown
}

type ListingSellerRow = {
  seller_id: string
}

function countOf(response: CountResponse) {
  return response.count ?? 0
}

function roundedPct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

function buildSignals(
  snapshot: Omit<GrowthSnapshot, "signals">,
): GrowthSignal[] {
  const signals: GrowthSignal[] = []
  const add = (
    id: string,
    severity: GrowthSignalSeverity,
    title: string,
    detail: string,
    href = "/admin/growth",
  ) => signals.push({ id, severity, title, detail, href })

  if (!snapshot.dataHealth.ok) {
    add(
      "partial-data",
      "critical",
      "Growth მონაცემები ნაწილობრივ ჩაიტვირთა",
      snapshot.dataHealth.failedSections.join(", ") + " წყაროები ვერ ჩაიტვირთა; გადაწყვეტილებები ნაწილობრივი snapshot-ით არ უნდა მივიღოთ.",
      "/admin/system",
    )
  }

  if (snapshot.activeListings < 250) {
    add(
      "supply-critical",
      "critical",
      "Supply ჯერ ძალიან მცირეა",
      "აქტიური განცხადებები არის " + snapshot.activeListings + ". ამ ფაზაში მთავარი KPI უნდა იყოს ახალი ხარისხიანი განცხადებები და არა ფართო buyer reach.",
    )
  } else if (snapshot.activeListings < TARGET_ACTIVE_LISTINGS) {
    add(
      "supply-build",
      "warning",
      "Supply growth კვლავ მთავარი პრიორიტეტია",
      "1,000 აქტიურ განცხადებამდე დარჩენილია " + snapshot.gapToTarget + ". მიმდინარე 30-დღიანი ტემპისთვის საჭიროა დაახლოებით " + snapshot.dailyListingTarget + " ახალი აქტიური განცხადება დღეში.",
    )
  }

  if (snapshot.activatedSellers < 100) {
    add(
      "seller-base",
      "warning",
      "Activated seller-ების ბაზა პატარაა",
      ACTIVE_SELLER_LISTING_THRESHOLD + "+ აქტიური განცხადებით seller-ების რაოდენობა არის " + snapshot.activatedSellers + ". Founding Sellers / referral კამპანია პირდაპირ ამ KPI-ზე უნდა მუშაობდეს.",
    )
  }

  if (snapshot.warmSellers > snapshot.activatedSellers) {
    add(
      "warm-sellers",
      "info",
      "1–2 განცხადებით seller-ებში სწრაფი activation შესაძლებლობაა",
      snapshot.warmSellers + " seller-ს უკვე აქვს 1–2 აქტიური განცხადება. მათთვის მესამე listing-ის სტიმული უფრო იაფი შეიძლება იყოს, ვიდრე სრულიად ახალი seller-ის მოყვანა.",
    )
  }

  if (snapshot.newProfiles7d > 0 && snapshot.listings7d < snapshot.newProfiles7d) {
    add(
      "signup-to-listing",
      "warning",
      "რეგისტრაციიდან listing-მდე friction ჩანს",
      "ბოლო 7 დღეში " + snapshot.newProfiles7d + " ახალი პროფილია და " + snapshot.listings7d + " ახალი non-draft listing. onboarding/first-listing კამპანია შესამოწმებელია.",
    )
  }

  if (snapshot.chats7d === 0 && snapshot.activeListings > 0) {
    add(
      "demand-signal",
      "warning",
      "ბოლო 7 დღეში chat demand არ ჩანს",
      "Supply-ის პარალელურად buyer discovery/content კამპანია შეიძლება დაგვჭირდეს, მაგრამ ჯერ listing liquidity უნდა შევინარჩუნოთ.",
      "/admin/search",
    )
  }

  if (!signals.length) {
    add(
      "healthy-growth",
      "info",
      "Growth snapshot-ში მკვეთრი bottleneck არ ჩანს",
      "განაგრძე seller acquisition, activation და listing quality ექსპერიმენტები; შედეგები 7-დღიან ჭრილში შეადარე.",
    )
  }

  const rank: Record<GrowthSignalSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  }

  return signals.sort((a, b) => rank[a.severity] - rank[b.severity])
}

export async function collectGrowthSnapshot(): Promise<GrowthSnapshot> {
  const admin = createAdminClient()
  const now = new Date()
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    activeListings,
    listings24h,
    listings7d,
    newProfiles24h,
    newProfiles7d,
    chats7d,
    sold7d,
    sellerRows,
  ] = await Promise.all([
    admin.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", cutoff24h)
      .in("status", ["pending_review", "active", "reserved", "sold"]),
    admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", cutoff7d)
      .in("status", ["pending_review", "active", "reserved", "sold"]),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", cutoff24h),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", cutoff7d),
    admin.from("chats").select("id", { count: "exact", head: true }).gte("created_at", cutoff7d),
    admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "sold")
      .gte("updated_at", cutoff7d),
    admin
      .from("listings")
      .select("seller_id")
      .eq("status", "active")
      .limit(MAX_ROWS),
  ])

  const failedSections = [
    ["active_listings", activeListings],
    ["listings_24h", listings24h],
    ["listings_7d", listings7d],
    ["profiles_24h", newProfiles24h],
    ["profiles_7d", newProfiles7d],
    ["chats_7d", chats7d],
    ["sold_7d", sold7d],
    ["seller_rows", sellerRows],
  ]
    .filter(([, response]) => Boolean((response as { error: unknown }).error))
    .map(([label]) => String(label))

  const perSeller = new Map<string, number>()
  for (const row of ((sellerRows.data ?? []) as ListingSellerRow[])) {
    perSeller.set(row.seller_id, (perSeller.get(row.seller_id) ?? 0) + 1)
  }

  const counts = [...perSeller.values()]
  const activatedSellers = counts.filter(
    (count) => count >= ACTIVE_SELLER_LISTING_THRESHOLD,
  ).length
  const warmSellers = counts.filter((count) => count >= 1 && count < ACTIVE_SELLER_LISTING_THRESHOLD).length
  const singleListingSellers = counts.filter((count) => count === 1).length
  const activeListingCount = countOf(activeListings as CountResponse)
  const gapToTarget = Math.max(0, TARGET_ACTIVE_LISTINGS - activeListingCount)
  const dailyListingTarget = Math.max(
    gapToTarget > 0 ? 1 : 0,
    Math.ceil(gapToTarget / TARGET_WINDOW_DAYS),
  )

  const base: Omit<GrowthSnapshot, "signals"> = {
    generatedAt: now.toISOString(),
    activeListings: activeListingCount,
    listings24h: countOf(listings24h as CountResponse),
    listings7d: countOf(listings7d as CountResponse),
    newProfiles24h: countOf(newProfiles24h as CountResponse),
    newProfiles7d: countOf(newProfiles7d as CountResponse),
    chats7d: countOf(chats7d as CountResponse),
    sold7d: countOf(sold7d as CountResponse),
    sellersWithActiveListings: counts.length,
    activatedSellers,
    warmSellers,
    singleListingSellers,
    activationRatePct: roundedPct(activatedSellers, counts.length),
    dailyListingTarget,
    gapToTarget,
    aiConfigured: Boolean(String(process.env.OPENAI_API_KEY ?? "").trim()),
    dataHealth: {
      ok: failedSections.length === 0,
      failedSections,
    },
  }

  return {
    ...base,
    signals: buildSignals(base),
  }
}

export function buildGrowthModelContext(snapshot: GrowthSnapshot) {
  return {
    generatedAt: snapshot.generatedAt,
    goal: {
      activeListingsTarget: TARGET_ACTIVE_LISTINGS,
      activatedSellerDefinition:
        ACTIVE_SELLER_LISTING_THRESHOLD + "+ active listings",
      gapToTarget: snapshot.gapToTarget,
      dailyListingTarget: snapshot.dailyListingTarget,
    },
    metrics: {
      activeListings: snapshot.activeListings,
      listings24h: snapshot.listings24h,
      listings7d: snapshot.listings7d,
      newProfiles24h: snapshot.newProfiles24h,
      newProfiles7d: snapshot.newProfiles7d,
      chats7d: snapshot.chats7d,
      sold7d: snapshot.sold7d,
      sellersWithActiveListings: snapshot.sellersWithActiveListings,
      activatedSellers: snapshot.activatedSellers,
      warmSellers: snapshot.warmSellers,
      singleListingSellers: snapshot.singleListingSellers,
      activationRatePct: snapshot.activationRatePct,
    },
    dataHealth: snapshot.dataHealth,
    signals: snapshot.signals,
    privacyNote:
      "Context contains aggregate marketplace metrics only. No names, emails, phone numbers, addresses, message bodies, or secrets are included.",
  }
}

export function buildFallbackGrowthSummary(snapshot: GrowthSnapshot) {
  return [
    "SamoSell Growth Agent — live read-only snapshot",
    "",
    "აქტიური განცხადებები: " + snapshot.activeListings + ".",
    "ბოლო 24სთ: +" + snapshot.listings24h + " listing / +" + snapshot.newProfiles24h + " profile.",
    "ბოლო 7 დღე: +" + snapshot.listings7d + " listing / +" + snapshot.newProfiles7d + " profile / " + snapshot.chats7d + " ახალი chat / " + snapshot.sold7d + " sold.",
    "Seller base: " + snapshot.sellersWithActiveListings + " seller აქტიური listing-ით; " + snapshot.activatedSellers + " activated (3+); " + snapshot.warmSellers + " warm (1–2).",
    "Activation rate: " + snapshot.activationRatePct + "%.",
    "",
    "1,000 აქტიურ განცხადებამდე gap: " + snapshot.gapToTarget + ".",
    "30-დღიანი pace target: დაახლოებით " + snapshot.dailyListingTarget + " ახალი აქტიური listing/დღე.",
    "",
    "დღევანდელი პრიორიტეტები:",
    ...snapshot.signals.slice(0, 5).map((signal) => "• " + signal.title + " — " + signal.detail),
    "",
    "ეს ფაზა მხოლოდ აანალიზებს და კამპანიის draft-ებს ამზადებს; თვითონ არ ხარჯავს ბიუჯეტს და არ აქვეყნებს სოციალურ ქსელებში.",
  ].join("\n")
}

export function buildFallbackGrowthReply(
  snapshot: GrowthSnapshot,
  message: string,
) {
  const query = message.toLocaleLowerCase("ka-GE")

  if (
    query.includes("კონტენტ") ||
    query.includes("post") ||
    query.includes("reel") ||
    query.includes("tiktok")
  ) {
    return [
      "დღევანდელი content angle: seller acquisition.",
      "",
      "Hook: „ტანსაცმელი, რომელსაც აღარ ატარებ, ფულია.“",
      "CTA: „გადაუღე ფოტო → დადე SamoSell-ზე → გაყიდე.“",
      "Secondary angle: „3 ნივთი დადე და გახდი activated seller.“",
      "",
      "რატომ: აქტიური განცხადებები არის " + snapshot.activeListings + ", ხოლო 3+ listing seller-ები — " + snapshot.activatedSellers + ".",
    ].join("\n")
  }

  if (
    query.includes("seller") ||
    query.includes("გამყიდ") ||
    query.includes("activation")
  ) {
    return [
      "Activated seller = 3+ აქტიური listing.",
      "ახლა activated არის " + snapshot.activatedSellers + "; warm seller (1–2 listing) — " + snapshot.warmSellers + ".",
      "ყველაზე იაფი შემდეგი ნაბიჯი: warm seller-ებს მივცეთ მესამე listing-ის სტიმული და პარალელურად Founding Sellers acquisition გავუშვათ.",
    ].join("\n")
  }

  if (
    query.includes("დღეს") ||
    query.includes("priority") ||
    query.includes("პრიორ")
  ) {
    return buildFallbackGrowthSummary(snapshot)
  }

  return buildFallbackGrowthSummary(snapshot)
}
