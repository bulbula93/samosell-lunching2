import type { CatalogListing } from "@/types/marketplace"

export function makeListing(overrides: Partial<CatalogListing> = {}): CatalogListing {
  return {
    id: "listing-1",
    slug: "linen-jacket",
    title: "თეთრეულის ვინტაჟური ქურთუკი",
    price: 120,
    currency: "GEL",
    condition: "good",
    city: "თბილისი",
    is_vip: false,
    brand_name: "SAMO",
    size_label: "M",
    category_name: "ვინტაჟი",
    category_slug: "vintage",
    seller_username: "nino",
    seller_full_name: "ნინო",
    seller_is_verified: true,
    seller_type: "user",
    seller_avatar_url: null,
    seller_store_logo_url: null,
    cover_image_url: null,
    favorites_count: 3,
    views_count: 15,
    status: "active",
    ...overrides,
  }
}
