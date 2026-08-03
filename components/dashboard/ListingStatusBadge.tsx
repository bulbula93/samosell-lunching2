import { listingStatusLabel } from "@/lib/listings"
import type { ListingStatus } from "@/lib/my-listings"

const STATUS_CLASS: Record<ListingStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  pending_review: "border-amber-200 bg-amber-50 text-amber-900",
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  reserved: "border-sky-200 bg-sky-50 text-sky-900",
  sold: "border-neutral-300 bg-neutral-100 text-neutral-800",
  rejected: "border-red-200 bg-red-50 text-red-800",
  archived: "border-violet-200 bg-violet-50 text-violet-800",
}

export default function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-xs font-bold ${STATUS_CLASS[status]}`}
    >
      <span aria-hidden="true" className="mr-1.5 text-[10px]">●</span>
      {listingStatusLabel(status)}
    </span>
  )
}
