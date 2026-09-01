import type { Metadata } from "next"
import ListingNotFound from "@/app/listing/[slug]/not-found"

export const metadata: Metadata = {
  title: "განცხადება ვერ მოიძებნა",
  alternates: { canonical: null },
  robots: { index: false, follow: true },
}

export default ListingNotFound
