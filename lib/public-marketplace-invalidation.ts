import "server-only"

import { revalidatePath, revalidateTag } from "next/cache"

import { marketplaceChangeTags, type MarketplaceChange } from "@/lib/public-marketplace-tags"

/** Call only after a successful public marketplace mutation. */
export function invalidatePublicMarketplace(change?: MarketplaceChange) {
  for (const tag of marketplaceChangeTags(change)) {
    revalidateTag(tag, { expire: 0 })
  }
  revalidatePath("/")
}

export function invalidatePublicAds() {
  revalidateTag("active-ads", { expire: 0 })
  revalidatePath("/")
}
