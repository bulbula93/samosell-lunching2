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
      return "Promoted"
    case "featured_home":
      return "Featured"
    case "combo":
      return "VIP + Featured"
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

  return {
    isVip: Boolean(listing.is_vip && (!vipDate || vipDate.getTime() > Date.now())),
    isPromoted: Boolean((listing.is_promoted ?? false) || (promotedDate && promotedDate.getTime() > Date.now())),
    isFeatured: Boolean((listing.is_featured ?? false) || (featuredDate && featuredDate.getTime() > Date.now())),
    vipUntil: vipDate,
    promotedUntil: promotedDate,
    featuredUntil: featuredDate,
    featuredSlot: listing.featured_slot ?? null,
  }
}

export function activePromotionBadges(listing: PromotionState) {
  const state = promotionStateFromListing(listing)
  return [
    state.isFeatured ? `Featured${state.featuredSlot ? ` #${state.featuredSlot}` : ""}` : null,
    state.isPromoted ? "Promoted" : null,
    state.isVip ? "VIP" : null,
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


export function buildSuggestedBoostReference(listingId: string, productId: string) {
  const listingPart = listingId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "LIST"
  const productPart = productId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "BOOST"
  return `SS-${listingPart}-${productPart}`
}


export function promotionBadgeClass(label?: string | null) {
  const value = String(label || "").toLowerCase()
  if (value.includes("vip")) return "ui-pill-vip"
  if (value.includes("featured")) return "ui-pill-featured"
  if (value.includes("promoted")) return "ui-pill-promoted"
  return "ui-pill-soft"
}
