// Only public resource identifiers belong in these tags. Never viewer identity.
export type MarketplaceChange = {
  listingId?: string | null
  slug?: string | null
  previousSlug?: string | null
  sellerId?: string | null
  categories?: (string | null | undefined)[]
}
export const listingTag = (id: string) => `public-listing:${id}`
export const slugTag = (slug: string) => `public-listing-slug:${slug}`
export const sellerTag = (id: string) => `public-seller:${id}`
export const categoryTag = (slug: string) => `public-category:${slug}`

/** Gender routes are exact filters; keyword/taxonomy routes can overlap.
 * Expire all five overlapping routes until an authoritative taxonomy mapping
 * is available. Unknown/legacy gender falls back to all category feeds.
 */
export function listingCategoryScope(...genders: (string | null | undefined)[]): string[] | undefined {
  if (!genders.length || genders.some(gender => !["women", "men", "kids", "unisex"].includes(gender ?? ""))) return undefined
  return [...new Set([...genders.filter((gender): gender is string => Boolean(gender && gender !== "unisex")), "footwear", "bags", "vintage", "accessories", "perfume"])]
}

export function marketplaceChangeTags(change?: MarketplaceChange) {
  if (!change || (!change.listingId && !change.slug && !change.sellerId)) return ["home-public-data", "public-listings", "public-sellers"]
  const tags = ["home-public-data", "public-feed"]
  // Feed rows embed seller names/avatars. Unknown categories must purge all
  // category feeds, but never unrelated listing descriptions or seller bundles.
  if (change.categories?.length && change.categories.every(Boolean)) tags.push(...change.categories.filter((s): s is string => Boolean(s)).map(categoryTag))
  else tags.push("public-categories")
  if (change.listingId) tags.push(listingTag(change.listingId))
  if (change.slug) tags.push(slugTag(change.slug))
  if (change.previousSlug) tags.push(slugTag(change.previousSlug))
  if (change.sellerId) tags.push(sellerTag(change.sellerId))
  else tags.push("public-sellers") // RPCs that return only a listing ID
  return [...new Set(tags)]
}
