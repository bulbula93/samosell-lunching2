export const LISTING_STATUSES = [
  "draft",
  "pending_review",
  "active",
  "reserved",
  "sold",
  "rejected",
  "archived",
] as const

export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const MY_LISTINGS_FILTERS = [
  { value: "all", label: "ყველა" },
  { value: "draft", label: "დრაფტი" },
  { value: "active", label: "აქტიური" },
  { value: "reserved", label: "დაჯავშნილი" },
  { value: "sold", label: "გაყიდული" },
  { value: "archived", label: "არქივი" },
] as const

export type MyListingsFilter = (typeof MY_LISTINGS_FILTERS)[number]["value"]

export const MY_LISTINGS_PAGE_SIZE = 12

const STATUS_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ["active", "archived"],
  pending_review: [],
  active: ["draft", "reserved", "sold", "archived"],
  reserved: ["active", "sold", "archived"],
  sold: ["active", "archived"],
  rejected: [],
  archived: ["draft"],
}

export function isListingStatus(value: unknown): value is ListingStatus {
  return LISTING_STATUSES.includes(value as ListingStatus)
}

export function parseMyListingsFilter(value: unknown): MyListingsFilter {
  const candidate = typeof value === "string" ? value : ""
  return MY_LISTINGS_FILTERS.some((filter) => filter.value === candidate)
    ? (candidate as MyListingsFilter)
    : "all"
}

export function parseMyListingsPage(value: unknown) {
  const candidate = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN
  return Number.isFinite(candidate) && candidate > 0 ? candidate : 1
}

export function getAllowedStatusTransitions(status: ListingStatus) {
  return STATUS_TRANSITIONS[status]
}

export function canTransitionListingStatus(current: ListingStatus, next: ListingStatus) {
  return STATUS_TRANSITIONS[current].includes(next)
}

export function getMyListingsPath(filter: MyListingsFilter, page = 1) {
  const search = new URLSearchParams()
  if (filter !== "all") search.set("status", filter)
  if (page > 1) search.set("page", String(page))
  const query = search.toString()
  return query ? `/dashboard/listings?${query}` : "/dashboard/listings"
}

export function listingStatusActionLabel(status: ListingStatus) {
  switch (status) {
    case "draft":
      return "დრაფტში დაბრუნება"
    case "active":
      return "გამოქვეყნება"
    case "reserved":
      return "დაჯავშნილად მონიშვნა"
    case "sold":
      return "გაყიდულად მონიშვნა"
    case "archived":
      return "არქივში გადატანა"
    default:
      return status
  }
}
