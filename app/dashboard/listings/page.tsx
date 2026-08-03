import Link from "next/link"
import { redirect } from "next/navigation"
import ListingManagementCard, {
  type ListingManagementItem,
} from "@/components/dashboard/ListingManagementCard"
import MyListingsPagination from "@/components/dashboard/MyListingsPagination"
import { requireAuthenticatedUser } from "@/lib/auth"
import {
  MY_LISTINGS_FILTERS,
  MY_LISTINGS_PAGE_SIZE,
  getMyListingsPath,
  isListingStatus,
  parseMyListingsFilter,
  parseMyListingsPage,
  type MyListingsFilter,
} from "@/lib/my-listings"

type MyListingsSearchParams = {
  created?: string | string[]
  updated?: string | string[]
  status?: string | string[]
  flash?: string | string[]
  page?: string | string[]
}

const LISTING_SELECT =
  "id, title, slug, price, currency, status, created_at, updated_at, cover_image_url, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot"

function readParam(value?: string | string[]) {
  return typeof value === "string" ? value : ""
}

function getFlashMessage(params: MyListingsSearchParams) {
  if (readParam(params.created)) return "განცხადება წარმატებით შეიქმნა."
  if (readParam(params.updated)) return "განცხადება წარმატებით განახლდა."

  switch (readParam(params.flash)) {
    case "created":
      return "განცხადება წარმატებით შეიქმნა."
    case "updated":
      return "განცხადება წარმატებით განახლდა."
    case "deleted":
      return "განცხადება წაიშალა."
    default:
      return ""
  }
}

function countQueryForFilter(
  supabase: Awaited<ReturnType<typeof requireAuthenticatedUser>>["supabase"],
  userId: string,
  filter: MyListingsFilter
) {
  const query = supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", userId)

  return filter === "all" ? query : query.eq("status", filter)
}

export default async function DashboardListingsPage({
  searchParams,
}: {
  searchParams?: Promise<MyListingsSearchParams>
}) {
  const params = (await searchParams) ?? {}
  const activeFilter = parseMyListingsFilter(readParam(params.status))
  const page = parseMyListingsPage(readParam(params.page))
  const rangeFrom = (page - 1) * MY_LISTINGS_PAGE_SIZE
  const rangeTo = rangeFrom + MY_LISTINGS_PAGE_SIZE - 1
  const flashMessage = getFlashMessage(params)

  const { supabase, user } = await requireAuthenticatedUser(
    getMyListingsPath(activeFilter, page)
  )

  let listingsQuery = supabase
    .from("listings")
    .select(LISTING_SELECT, { count: "exact" })
    .eq("seller_id", user.id)

  if (activeFilter !== "all") {
    listingsQuery = listingsQuery.eq("status", activeFilter)
  }

  listingsQuery = listingsQuery
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo)

  const [listingsResponse, ...countResponses] = await Promise.all([
    listingsQuery,
    ...MY_LISTINGS_FILTERS.map((filter) =>
      countQueryForFilter(supabase, user.id, filter.value)
    ),
  ])

  const queryError =
    listingsResponse.error || countResponses.find((response) => response.error)?.error

  if (queryError) {
    console.error("my_listings_query_failed", queryError.message)
    throw new Error("MY_LISTINGS_QUERY_FAILED")
  }

  const rawListings = listingsResponse.data ?? []
  if (rawListings.some((item) => !isListingStatus(item.status))) {
    console.error("my_listings_invalid_status")
    throw new Error("MY_LISTINGS_INVALID_STATUS")
  }

  const listings = rawListings as ListingManagementItem[]
  const totalCount = listingsResponse.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / MY_LISTINGS_PAGE_SIZE))

  if (totalCount > 0 && page > totalPages) {
    redirect(getMyListingsPath(activeFilter, totalPages))
  }

  const counts = Object.fromEntries(
    MY_LISTINGS_FILTERS.map((filter, index) => [
      filter.value,
      countResponses[index]?.count ?? 0,
    ])
  ) as Record<MyListingsFilter, number>
  const accountIsEmpty = counts.all === 0

  return (
    <main className="min-h-screen bg-bg py-7 text-text sm:py-10">
      <div className="ui-container max-w-6xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-eyebrow">გაყიდვების სივრცე</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              ჩემი განცხადებები
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-soft sm:text-base">
              ნახე, განაახლე და უსაფრთხოდ მართე საკუთარი განცხადებების ხილვადობა.
            </p>
          </div>
          <Link href="/dashboard/listings/new" className="ui-btn-primary w-full sm:w-auto">
            <span aria-hidden="true" className="mr-2 text-lg">＋</span>
            ახალი განცხადება
          </Link>
        </header>

        {flashMessage ? (
          <p
            role="status"
            className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
          >
            {flashMessage}
          </p>
        ) : null}

        <nav aria-label="განცხადებების სტატუსით გაფილტვრა" className="mt-7">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {MY_LISTINGS_FILTERS.map((filter) => {
              const isActive = filter.value === activeFilter
              return (
                <Link
                  key={filter.value}
                  href={getMyListingsPath(filter.value)}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-xl border px-4 py-2 text-sm font-bold transition ${
                    isActive
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-white text-text-soft hover:border-brand/40 hover:bg-brand-soft/40 hover:text-text"
                  }`}
                >
                  {filter.label}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      isActive ? "bg-white/15 text-white" : "bg-surface-alt text-text-soft"
                    }`}
                  >
                    {counts[filter.value]}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>

        {listings.length > 0 ? (
          <>
            <section aria-label="ჩემი განცხადებების სია" className="mt-6 space-y-4">
              {listings.map((item) => (
                <ListingManagementCard key={item.id} item={item} />
              ))}
            </section>
            <MyListingsPagination
              filter={activeFilter}
              page={page}
              totalPages={totalPages}
              totalItems={totalCount}
            />
          </>
        ) : (
          <section
            role="status"
            className="ui-card mt-6 border-dashed px-5 py-12 text-center sm:px-8 sm:py-16"
          >
            <div
              aria-hidden="true"
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-2xl text-brand"
            >
              {accountIsEmpty ? "＋" : "⌕"}
            </div>
            <h2 className="mt-5 text-2xl font-black">
              {accountIsEmpty
                ? "პირველი განცხადება დაამატე"
                : "ამ სტატუსით განცხადება არ არის"}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-text-soft">
              {accountIsEmpty
                ? "ატვირთე ნივთის ფოტოები, მიუთითე ფასი და რამდენიმე წუთში გამოაქვეყნე."
                : "აირჩიე სხვა სტატუსი ან დაბრუნდი ყველა განცხადების სიაში."}
            </p>
            {accountIsEmpty ? (
              <Link href="/dashboard/listings/new" className="ui-btn-primary mt-7">
                განცხადების დამატება
              </Link>
            ) : (
              <Link href="/dashboard/listings" className="ui-btn-secondary mt-7">
                ყველა განცხადება
              </Link>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
