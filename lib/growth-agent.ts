import "server-only"

import { createClient } from "@/lib/supabase/server"

const ACTIVE_SELLER_LISTING_THRESHOLD = 3
const TARGET_ACTIVE_LISTINGS = 1000
const TARGET_WINDOW_DAYS = 30

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

type GrowthRpcPayload = {
  generatedAt?: string
  activeListings?: number | string
  listings24h?: number | string
  listings7d?: number | string
  newProfiles24h?: number | string
  newProfiles7d?: number | string
  chats7d?: number | string
  sold7d?: number | string
  sellersWithActiveListings?: number | string
  activatedSellers?: number | string
  warmSellers?: number | string
  singleListingSellers?: number | string
}

function safeNumber(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0
}

export async function collectGrowthSnapshot(): Promise<GrowthSnapshot> {
  const supabase = await createClient()
  const now = new Date()
  const { data, error } = await supabase.rpc("admin_growth_snapshot")
  const payload = (data ?? {}) as GrowthRpcPayload

  const activeListings = safeNumber(payload.activeListings)
  const listings24h = safeNumber(payload.listings24h)
  const listings7d = safeNumber(payload.listings7d)
  const newProfiles24h = safeNumber(payload.newProfiles24h)
  const newProfiles7d = safeNumber(payload.newProfiles7d)
  const chats7d = safeNumber(payload.chats7d)
  const sold7d = safeNumber(payload.sold7d)
  const sellersWithActiveListings = safeNumber(payload.sellersWithActiveListings)
  const activatedSellers = safeNumber(payload.activatedSellers)
  const warmSellers = safeNumber(payload.warmSellers)
  const singleListingSellers = safeNumber(payload.singleListingSellers)

  const gapToTarget = Math.max(0, TARGET_ACTIVE_LISTINGS - activeListings)
  const dailyListingTarget = Math.max(
    gapToTarget > 0 ? 1 : 0,
    Math.ceil(gapToTarget / TARGET_WINDOW_DAYS),
  )

  const base: Omit<GrowthSnapshot, "signals"> = {
    generatedAt:
      typeof payload.generatedAt === "string" && payload.generatedAt
        ? payload.generatedAt
        : now.toISOString(),
    activeListings,
    listings24h,
    listings7d,
    newProfiles24h,
    newProfiles7d,
    chats7d,
    sold7d,
    sellersWithActiveListings,
    activatedSellers,
    warmSellers,
    singleListingSellers,
    activationRatePct: roundedPct(activatedSellers, sellersWithActiveListings),
    dailyListingTarget,
    gapToTarget,
    aiConfigured: Boolean(String(process.env.OPENAI_API_KEY ?? "").trim()),
    dataHealth: {
      ok: !error,
      failedSections: error ? ["admin_growth_snapshot"] : [],
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
