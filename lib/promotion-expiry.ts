import type { CatalogListing } from "@/types/marketplace"

export function refreshPromotion<T extends CatalogListing>(item: T, now = Date.now()): T {
  const active = (value?: string | null) => Boolean(value && Date.parse(value) > now)
  const is_vip = Boolean(item.is_vip && active(item.vip_until))
  const is_promoted = Boolean(item.is_promoted && active(item.promoted_until))
  const is_featured = Boolean(item.is_featured && active(item.featured_until))
  const is_home_banner = Boolean(item.is_home_banner && active(item.home_banner_until))
  return { ...item, is_vip, is_promoted, is_featured, is_home_banner,
    promotion_tier: is_featured ? 3 : is_promoted ? 2 : is_vip ? 1 : 0 }
}
