import "server-only"

import { revalidatePath, revalidateTag } from "next/cache"

/** Call only after a successful public marketplace mutation. */
export function invalidatePublicMarketplace() {
  for (const tag of ["home-public-data", "public-listings", "public-sellers"]) {
    revalidateTag(tag, { expire: 0 })
  }
  revalidatePath("/")
}

export function invalidatePublicAds() {
  revalidateTag("active-ads", { expire: 0 })
  revalidatePath("/")
}
