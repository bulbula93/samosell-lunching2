import Link from "next/link"
import { ka } from "@/lib/i18n/ka"
import type { CatalogListing } from "@/types/marketplace"

export default function ListingBreadcrumbs({ listing }: { listing: CatalogListing }) {
  const categoryHref = listing.category_slug
    ? `/catalog?category=${encodeURIComponent(listing.category_slug)}`
    : null

  return (
    <nav
      aria-label="Breadcrumb"
      className="ui-container overflow-hidden pt-5 sm:pt-7"
    >
      <ol className="flex min-w-0 items-center gap-2 text-sm text-text-soft">
        <li className="shrink-0">
          <Link
            href="/catalog"
            className="rounded-md transition hover:text-brand focus-visible:text-brand"
          >
            {ka.listingDetail.catalog}
          </Link>
        </li>
        <li aria-hidden="true" className="text-line">
          /
        </li>
        <li className="min-w-0">
          {categoryHref ? (
            <Link
              href={categoryHref}
              className="block truncate rounded-md transition hover:text-brand focus-visible:text-brand"
            >
              {listing.category_name}
            </Link>
          ) : (
            <span className="block truncate">{listing.category_name}</span>
          )}
        </li>
        <li aria-hidden="true" className="text-line">
          /
        </li>
        <li aria-current="page" className="min-w-0 truncate font-semibold text-text">
          {listing.title}
        </li>
      </ol>
    </nav>
  )
}
