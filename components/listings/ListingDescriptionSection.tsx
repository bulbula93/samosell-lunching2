import Link from "next/link"
import type { CatalogListing } from "@/types/marketplace"

export default function ListingDescriptionSection({ listing }: { listing: CatalogListing }) {
  return (
    <div className="rounded-[1rem] border border-line bg-white p-5 shadow-[0_12px_34px_rgba(23,23,23,0.05)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">აღწერა</div>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">ნივთის სრული ინფორმაცია</h2>
        </div>
        <Link
          href={`/catalog?category=${listing.category_slug ?? ""}`}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700"
        >
          ამ კატეგორიის სხვა ნივთები
        </Link>
      </div>
      <p className="mt-5 whitespace-pre-wrap leading-7 text-neutral-700">{listing.description || "აღწერა არ არის მითითებული."}</p>
    </div>
  )
}
