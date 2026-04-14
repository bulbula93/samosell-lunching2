import Link from "next/link"

type CatalogPaginationProps = {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  pageHref: (page: number) => string
}

function buildWindow(page: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  const values = new Set<number>([1, totalPages, page - 1, page, page + 1])
  if (page <= 3) {
    values.add(2)
    values.add(3)
  }
  if (page >= totalPages - 2) {
    values.add(totalPages - 1)
    values.add(totalPages - 2)
  }

  return Array.from(values)
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b)
}

function roundButtonClass(disabled: boolean) {
  return [
    "inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm transition",
    disabled ? "cursor-not-allowed border-[#E2E2E2] bg-white text-[#C7C7C7]" : "border-[#E2E2E2] bg-white text-[#7B7B7B] hover:border-[#B8B8B8] hover:text-[#2D2D2D]",
  ].join(" ")
}

export default function CatalogPagination({ page, totalPages, totalItems, pageSize, pageHref }: CatalogPaginationProps) {
  if (totalItems <= pageSize) return null

  const rangeStart = (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalItems)
  const pageNumbers = buildWindow(page, totalPages)

  return (
    <div className="rounded-[8px] bg-[#ECECEC] px-3 py-4 sm:px-4 lg:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#555]">
            Showing {rangeStart} to {rangeEnd} out of {totalItems} results
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={page > 1 ? pageHref(1) : pageHref(1)} aria-disabled={page <= 1} className={roundButtonClass(page <= 1)}>
              «
            </Link>
            <Link href={page > 1 ? pageHref(page - 1) : pageHref(1)} aria-disabled={page <= 1} className={roundButtonClass(page <= 1)}>
              ‹
            </Link>

            {pageNumbers.map((item, index) => {
              const previous = pageNumbers[index - 1]
              const gap = previous && item - previous > 1
              return (
                <div key={`page-${item}`} className="flex items-center gap-2">
                  {gap ? <span className="px-1 text-sm text-[#868686]">…</span> : null}
                  <Link
                    href={pageHref(item)}
                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-[6px] px-2.5 text-sm font-semibold transition ${item === page ? "bg-[#2C2C2C] text-white" : "bg-white text-[#666] hover:bg-[#F7F7F7]"}`}
                  >
                    {item}
                  </Link>
                </div>
              )
            })}

            <Link href={page < totalPages ? pageHref(page + 1) : pageHref(totalPages)} aria-disabled={page >= totalPages} className={roundButtonClass(page >= totalPages)}>
              ›
            </Link>
            <Link href={page < totalPages ? pageHref(totalPages) : pageHref(totalPages)} aria-disabled={page >= totalPages} className={roundButtonClass(page >= totalPages)}>
              »
            </Link>
          </div>

          <div className="flex items-center gap-3 text-sm text-[#555]">
            <span>გვერდის არჩევა</span>
            <div className="inline-flex h-10 min-w-[5.5rem] items-center justify-between rounded-[8px] border border-[#D9D9D9] bg-white px-3 text-[#2D2D2D]">
              <span>{page}</span>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 text-[#7C7C7C]">
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
