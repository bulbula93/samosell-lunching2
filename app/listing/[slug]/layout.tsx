import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { generateListingMetadata } from "@/lib/listing-page"

export default async function ListingLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const metadata = await generateListingMetadata(slug)

  if (!metadata) notFound()

  return children
}
