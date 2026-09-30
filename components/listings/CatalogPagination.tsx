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

function navButtonClass(disabled: boolean) {
  return [
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition",
    disabled
      ? "pointer-events-none border-line/70 bg-[#f5f6f5] text-text-soft/45"
      : "border-brand/12 bg-white text-brand shadow-[0_6px_18px_rgba(7,63,59,0.04)] hover:-translate-y-0.5 hover:border-brand/25 hover:bg-brand-soft/35",
  ].join(" ")
}

export default function CatalogPagination({ page, totalPages, totalItems, pageSize, pageHref }: CatalogPaginationProps) {
  if (totalItems <= pageSize) return null

  const rangeStart = (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalItems)
  const pageNumbers = buildWindow(page, totalPages)

  return (
    <nav
      aria-label="კატალოგის გვერდები"
      className="rounded-[24px] border border-line/80 bg-[#fbfaf7] px-4 py-5 shadow-[0_10px_30px_rgba(7,63,59,0.04)] sm:px-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-text-soft">
            <span className="font-black text-brand">{totalItems}</span> განცხადებიდან ნაჩვენებია{" "}
            <span className="font-black text-brand">{rangeStart}–{rangeEnd}</span>
          </p>
          <span className="rounded-full bg-brand-soft/55 px-3 py-1.5 text-xs font-black text-brand">
            გვერდი {page} / {totalPages}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={page > 1 ? pageHref(page - 1) : pageHref(1)}
            aria-disabled={page <= 1}
            className={navButtonClass(page <= 1)}
          >
            <span aria-hidden="true">←</span>
            <span>წინა</span>
          </Link>

          <div className="flex items-center gap-1.5">
            {pageNumbers.map((item, index) => {
              const previous = pageNumbers[index - 1]
              const gap = previous && item - previous > 1

              return (
                <div key={`page-${item}`} className="flex items-center gap-1.5">
                  {gap ? <span className="px-1 text-sm font-bold text-text-soft">…</span> : null}
                  <Link
                    href={pageHref(item)}
                    aria-current={item === page ? "page" : undefined}
                    className={`inline-flex h-11 min-w-11 items-center justify-center rounded-2xl px-3 text-sm font-black transition ${
                      item === page
                        ? "bg-brand text-white shadow-[0_8px_22px_rgba(7,63,59,0.16)]"
                        : "border border-transparent bg-white text-brand hover:border-brand/15 hover:bg-brand-soft/35"
                    }`}
                  >
                    {item}
                  </Link>
                </div>
              )
            })}
          </div>

          <Link
            href={page < totalPages ? pageHref(page + 1) : pageHref(totalPages)}
            aria-disabled={page >= totalPages}
            className={navButtonClass(page >= totalPages)}
          >
            <span>შემდეგი</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </nav>
  )
}
