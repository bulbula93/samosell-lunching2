import type { BoostProduct, PromotionState } from "@/types/boost"

const DAY_IN_MS = 24 * 60 * 60 * 1000

function safeDateValue(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function placementLabel(value?: string | null) {
  switch (value) {
    case "vip":
      return "VIP"
    case "promoted":
      return "TOP"
    case "featured_home":
      return "მთავარი გვერდის გამორჩეული პოზიცია"
    case "banner_home":
      return "მთავარი გვერდის ბანერი"
    case "combo":
      return "VIP MAX"
    default:
      return value || "VIP"
  }
}

export function boostStatusLabel(value?: string | null, endsAt?: string | null) {
  if (value === "active" && isExpired(endsAt)) return "დასრულებული"

  switch (value) {
    case "pending_payment":
      return "გადახდის მოლოდინში"
    case "under_review":
      return "შემოწმებაში"
    case "approved":
      return "დადასტურებულია"
    case "active":
      return "აქტიური"
    case "expired":
      return "დასრულებული"
    case "rejected":
      return "უარყოფილი"
    case "cancelled":
      return "გაუქმებული"
    default:
      return value || "უცნობი"
  }
}

export function isExpired(value?: string | null) {
  const date = safeDateValue(value)
  return Boolean(date && date.getTime() <= Date.now())
}

export function promotionStateFromListing(listing: PromotionState) {
  const vipDate = safeDateValue(listing.vip_until)
  const promotedDate = safeDateValue(listing.promoted_until)
  const featuredDate = safeDateValue(listing.featured_until)
  const bannerDate = safeDateValue(listing.home_banner_until)

  return {
    isVip: Boolean(listing.is_vip && (!vipDate || vipDate.getTime() > Date.now())),
    isPromoted: Boolean((listing.is_promoted ?? false) || (promotedDate && promotedDate.getTime() > Date.now())),
    isFeatured: Boolean((listing.is_featured ?? false) || (featuredDate && featuredDate.getTime() > Date.now())),
    isHomeBanner: Boolean((listing.is_home_banner ?? false) || (bannerDate && bannerDate.getTime() > Date.now())),
    vipUntil: vipDate,
    promotedUntil: promotedDate,
    featuredUntil: featuredDate,
    featuredSlot: listing.featured_slot ?? null,
    homeBannerUntil: bannerDate,
    homeBannerSlot: listing.home_banner_slot ?? null,
  }
}

export function activePromotionBadges(listing: PromotionState) {
  const state = promotionStateFromListing(listing)
  return [
    state.isFeatured ? `VIP MAX${state.featuredSlot ? ` #${state.featuredSlot}` : ""}` : null,
    state.isPromoted ? "TOP" : null,
    state.isVip ? "VIP" : null,
    state.isHomeBanner ? "მთავარი გვერდის ბანერი" : null,
  ].filter(Boolean) as string[]
}

export function formatDateTime(value?: string | null) {
  const date = safeDateValue(value)
  if (!date) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function formatDateOnly(value?: string | null) {
  const date = safeDateValue(value)
  if (!date) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
}

export function buildBoostDurationEndsAt(baseValue: string | null | undefined, durationDays: number) {
  const now = new Date()
  const baseDate = safeDateValue(baseValue)
  const anchor = baseDate && baseDate.getTime() > now.getTime() ? baseDate : now
  return new Date(anchor.getTime() + durationDays * DAY_IN_MS).toISOString()
}

export function paymentMethodLabel(value?: string | null) {
  switch (value) {
    case "bank_transfer":
      return "საბანკო გადარიცხვა"
    case "manual_cash":
      return "ქეში / ოფლაინ"
    case "card_external":
      return "გარე ბარათის ლინკი"
    case "tbc_checkout":
      return "TBC Checkout"
    default:
      return value || "—"
  }
}

export function productPriceLabel(product: Pick<BoostProduct, "price" | "currency" | "duration_days">) {
  return `${product.price} ${product.currency === "GEL" ? "₾" : product.currency} · ${product.duration_days} დღე`
}

export function boostProductName(value?: string | null, placement?: string | null) {
  if (placement) return placementLabel(placement)
  return value || "გაძლიერების პაკეტი"
}

export function boostProductBenefits(placement?: string | null) {
  switch (placement) {
    case "vip":
      return ["VIP ბეჯი", "მთავარი გვერდის VIP სივრცე", "VIP ფილტრი"]
    case "promoted":
      return ["უფრო მაღალი ადგილი კატალოგში", "მეტი ხილვადობა ძებნაში", "TOP მონიშვნა"]
    case "combo":
      return ["VIP-ის ყველა უპირატესობა", "TOP პოზიცია", "მთავარი გვერდის გამორჩეული ბლოკი"]
    case "banner_home":
      return ["დიდი სარეკლამო ბანერი", "მთავარი გვერდის გამორჩეული სივრცე", "7-დღიანი განთავსება"]
    case "featured_home":
      return ["მთავარი გვერდის გამორჩეული პოზიცია"]
    default:
      return []
  }
}

export function boostProductCta(placement?: string | null) {
  switch (placement) {
    case "vip": return "გააქტიურე VIP"
    case "promoted": return "აიყვანე TOP-ში"
    case "combo": return "გააქტიურე VIP MAX"
    case "banner_home": return "განათავსე ბანერზე"
    default: return "გააძლიერე განცხადება"
  }
}

export function activePromotionEndsAt(listing: PromotionState, placement?: string | null) {
  const state = promotionStateFromListing(listing)
  switch (placement) {
    case "vip": return state.isVip ? state.vipUntil : null
    case "promoted": return state.isPromoted ? state.promotedUntil : null
    case "featured_home": return state.isFeatured ? state.featuredUntil : null
    case "banner_home": return state.isHomeBanner ? state.homeBannerUntil : null
    case "combo": {
      if (!state.isVip || !state.isPromoted || !state.isFeatured) return null
      const values = [state.vipUntil, state.promotedUntil, state.featuredUntil].filter(Boolean) as Date[]
      return values.sort((left, right) => left.getTime() - right.getTime())[0] ?? null
    }
    default: return null
  }
}


export function buildSuggestedBoostReference(listingId: string, productId: string) {
  const listingPart = listingId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "LIST"
  const productPart = productId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "BOOST"
  return `SS-${listingPart}-${productPart}`
}


export function promotionBadgeClass(label?: string | null) {
  const value = String(label || "").toLowerCase()
  if (value.includes("vip")) return "ui-pill-vip"
  if (value.includes("max") || value.includes("გამორჩეული")) return "ui-pill-featured"
  if (value.includes("top")) return "ui-pill-promoted"
  return "ui-pill-soft"
}
