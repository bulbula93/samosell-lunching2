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

export function marketplaceChangeTags(change?: MarketplaceChange) {
  if (!change) return ["home-public-data", "public-listings", "public-sellers"]
  const tags = ["home-public-data", "public-feed"]
  // Feed rows embed seller names/avatars. Unknown categories must purge all
  // category feeds, but never unrelated listing descriptions or seller bundles.
  if (change.categories?.length) tags.push(...change.categories.filter((s): s is string => Boolean(s)).map(categoryTag))
  else tags.push("public-categories")
  if (change.listingId) tags.push(listingTag(change.listingId))
  if (change.slug) tags.push(slugTag(change.slug))
  if (change.previousSlug) tags.push(slugTag(change.previousSlug))
  if (change.sellerId) tags.push(sellerTag(change.sellerId))
  else tags.push("public-sellers") // RPCs that return only a listing ID
  return [...new Set(tags)]
}
