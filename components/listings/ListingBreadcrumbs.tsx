import Link from "next/link"
import type { CatalogListing } from "@/types/marketplace"

export default function ListingBreadcrumbs({ listing }: { listing: CatalogListing }) {
  return (
    <section className="ui-container pt-8 sm:pt-10">
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <Link href="/catalog" className="hover:text-neutral-800">
          კატალოგი
        </Link>
        <span>•</span>
        {listing.category_slug ? (
          <Link href={`/catalog?category=${listing.category_slug}`} className="hover:text-neutral-800">
            {listing.category_name}
          </Link>
        ) : (
          <span>{listing.category_name}</span>
        )}
        <span>•</span>
        <span className="text-neutral-700">{listing.title}</span>
      </div>
    </section>
  )
}
