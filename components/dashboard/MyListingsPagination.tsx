import Link from "next/link"
import { getMyListingsPath, type MyListingsFilter } from "@/lib/my-listings"

type MyListingsPaginationProps = {
  filter: MyListingsFilter
  page: number
  totalPages: number
  totalItems: number
}

export default function MyListingsPagination({
  filter,
  page,
  totalPages,
  totalItems,
}: MyListingsPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav
      aria-label="განცხადებების გვერდები"
      className="ui-card mt-8 flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-text-soft">
        გვერდი <strong className="text-text">{page}</strong> / {totalPages} · სულ {totalItems}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={getMyListingsPath(filter, page - 1)} className="ui-btn-secondary">
            წინა
          </Link>
        ) : (
          <span aria-disabled="true" className="ui-btn-secondary cursor-not-allowed opacity-50">
            წინა
          </span>
        )}
        {page < totalPages ? (
          <Link href={getMyListingsPath(filter, page + 1)} className="ui-btn-secondary">
            შემდეგი
          </Link>
        ) : (
          <span aria-disabled="true" className="ui-btn-secondary cursor-not-allowed opacity-50">
            შემდეგი
          </span>
        )}
      </div>
    </nav>
  )
}
