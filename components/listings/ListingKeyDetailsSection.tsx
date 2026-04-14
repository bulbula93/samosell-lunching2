import { conditionLabel, genderLabel } from "@/lib/listings"
import type { CatalogListing } from "@/types/marketplace"

const detailItems = (listing: CatalogListing) => [
  { label: "კატეგორია", value: listing.category_name },
  { label: "ბრენდი", value: listing.brand_name || "—" },
  { label: "ზომა", value: listing.size_label || "—" },
  { label: "მდგომარეობა", value: conditionLabel(listing.condition) },
  { label: "ქალაქი", value: listing.city || "—" },
  { label: "ფერი", value: listing.color || "—" },
  { label: "მასალა", value: listing.material || "—" },
  { label: "სექცია", value: genderLabel(listing.gender) },
]

export default function ListingKeyDetailsSection({
  listing,
  publishedLabel,
  reasons,
}: {
  listing: CatalogListing
  publishedLabel?: string | null
  reasons: string[]
}) {
  return (
    <div className="rounded-[1rem] border border-line bg-white p-5 shadow-[0_12px_34px_rgba(23,23,23,0.05)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">მთავარი მონაცემები</div>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">რაზე უნდა მიაქციო ყურადღება</h2>
        </div>
        {publishedLabel ? (
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{publishedLabel}</span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {detailItems(listing).map((item) => (
          <div key={item.label} className="rounded-[1.5rem] bg-neutral-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{item.label}</div>
            <div className="mt-2 text-lg font-black text-neutral-900">{item.value}</div>
          </div>
        ))}
      </div>

      {reasons.length > 0 ? (
        <div className="mt-5 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">რატომ ღირს ნახვა</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {reasons.map((reason) => (
              <span key={reason} className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-neutral-700">
                {reason}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
