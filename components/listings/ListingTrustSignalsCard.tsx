export default function ListingTrustSignalsCard({
  sellerVerified,
  sellerActiveListingsCount,
  sellerTotalListingsCount,
}: {
  sellerVerified: boolean
  sellerActiveListingsCount: number
  sellerTotalListingsCount: number
}) {
  return (
    <div className="rounded-[1rem] border border-line bg-white p-5 shadow-[0_12px_34px_rgba(23,23,23,0.05)] sm:p-6">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">ნდობის სიგნალები</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {sellerVerified ? <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">დადასტურებული პროფილი</span> : null}
        {sellerActiveListingsCount > 1 ? <span className="rounded-full bg-surface-alt px-3 py-2 text-sm font-semibold text-text">მრავალი აქტიური ნივთი</span> : null}
        {sellerTotalListingsCount > sellerActiveListingsCount ? <span className="rounded-full bg-surface-alt px-3 py-2 text-sm font-semibold text-text">ისტორია პროფილზე</span> : null}
        <span className="rounded-full bg-surface-alt px-3 py-2 text-sm font-semibold text-text">პირდაპირი ჩათი</span>
      </div>
    </div>
  )
}
