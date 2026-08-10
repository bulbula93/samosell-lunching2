import {
  MARKETPLACE_ORDER_STATUSES,
  type MarketplaceOrderRole,
  type MarketplaceOrderStatus,
} from "@/types/order"

export const ORDER_PAGE_SIZE = 12
export const ORDER_ROLE_FILTERS = ["all", "buyer", "seller"] as const
export type OrderRoleFilter = (typeof ORDER_ROLE_FILTERS)[number]

export function isMarketplaceOrderStatus(value: unknown): value is MarketplaceOrderStatus {
  return MARKETPLACE_ORDER_STATUSES.includes(value as MarketplaceOrderStatus)
}

export function parseOrderRoleFilter(value?: string | null): OrderRoleFilter {
  return ORDER_ROLE_FILTERS.includes(value as OrderRoleFilter)
    ? (value as OrderRoleFilter)
    : "all"
}

export function parseOrderStatusFilter(value?: string | null): MarketplaceOrderStatus | "all" {
  return isMarketplaceOrderStatus(value) ? value : "all"
}

export function parseOrderPage(value?: string | null) {
  const page = Number.parseInt(String(value ?? ""), 10)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export function marketplaceOrderStatusLabel(status: MarketplaceOrderStatus) {
  switch (status) {
    case "pending_payment":
      return "გადახდის მოლოდინში"
    case "paid":
      return "გადახდილია"
    case "seller_confirmed":
      return "გამყიდველმა დაადასტურა"
    case "shipped":
      return "გაგზავნილია"
    case "delivered":
      return "მიტანილია"
    case "completed":
      return "დასრულებულია"
    case "cancelled":
      return "გაუქმებულია"
    case "disputed":
      return "დავა მიმდინარეობს"
    case "refunded":
      return "თანხა დაბრუნებულია"
  }
}

export function marketplaceOrderStatusDescription(status: MarketplaceOrderStatus) {
  switch (status) {
    case "pending_payment":
      return "შეკვეთა შექმნილია, მაგრამ provider-ს გადახდა ჯერ არ დაუდასტურებია."
    case "paid":
      return "გადახდა provider-მა დაადასტურა; გამყიდველის პასუხს ველოდებით."
    case "seller_confirmed":
      return "გამყიდველმა შეკვეთა დაადასტურა და გასაგზავნად ამზადებს."
    case "shipped":
      return "გამყიდველმა ნივთი გაგზავნილად მონიშნა."
    case "delivered":
      return "მყიდველმა ნივთის მიღება დაადასტურა."
    case "completed":
      return "შეკვეთის lifecycle დასრულებულია."
    case "cancelled":
      return "შეკვეთა გადახდამდე გაუქმდა."
    case "disputed":
      return "შეკვეთა შეჩერებულია დავის განხილვამდე."
    case "refunded":
      return "provider-ის ჩანაწერით თანხა დაბრუნებულია."
  }
}

export function orderStatusClasses(status: MarketplaceOrderStatus) {
  if (status === "cancelled" || status === "refunded") {
    return "border-neutral-300 bg-neutral-100 text-neutral-800"
  }
  if (status === "disputed") {
    return "border-red-200 bg-red-50 text-red-800"
  }
  if (status === "pending_payment") {
    return "border-amber-200 bg-amber-50 text-amber-900"
  }
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800"
  }
  return "border-sky-200 bg-sky-50 text-sky-900"
}

export function getAllowedOrderTransitions(
  status: MarketplaceOrderStatus,
  role: MarketplaceOrderRole,
): MarketplaceOrderStatus[] {
  if (role === "buyer") {
    switch (status) {
      case "pending_payment":
        return ["cancelled"]
      case "paid":
      case "seller_confirmed":
        return ["disputed"]
      case "shipped":
        return ["delivered", "disputed"]
      case "delivered":
        return ["completed", "disputed"]
      default:
        return []
    }
  }

  switch (status) {
    case "pending_payment":
      return ["cancelled"]
    case "paid":
      return ["seller_confirmed"]
    case "seller_confirmed":
      return ["shipped"]
    default:
      return []
  }
}

export function canTransitionMarketplaceOrder(
  status: MarketplaceOrderStatus,
  nextStatus: MarketplaceOrderStatus,
  role: MarketplaceOrderRole,
) {
  return getAllowedOrderTransitions(status, role).includes(nextStatus)
}

export function marketplaceOrderActionLabel(status: MarketplaceOrderStatus) {
  switch (status) {
    case "seller_confirmed":
      return "შეკვეთის დადასტურება"
    case "shipped":
      return "გაგზავნილად მონიშვნა"
    case "delivered":
      return "მიღების დადასტურება"
    case "completed":
      return "შეკვეთის დასრულება"
    case "cancelled":
      return "შეკვეთის გაუქმება"
    case "disputed":
      return "დავის გახსნა"
    default:
      return marketplaceOrderStatusLabel(status)
  }
}

export function getOrdersPath(options?: {
  role?: OrderRoleFilter
  status?: MarketplaceOrderStatus | "all"
  page?: number
}) {
  const search = new URLSearchParams()
  if (options?.role && options.role !== "all") search.set("role", options.role)
  if (options?.status && options.status !== "all") search.set("status", options.status)
  if (options?.page && options.page > 1) search.set("page", String(options.page))
  const query = search.toString()
  return query ? `/dashboard/orders?${query}` : "/dashboard/orders"
}
