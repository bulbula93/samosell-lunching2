import type { Metadata } from "next"
import NotFound from "@/app/not-found"

export const metadata: Metadata = {
  title: "კატეგორია ვერ მოიძებნა",
  alternates: { canonical: null },
  robots: { index: false, follow: true },
}

export default NotFound
