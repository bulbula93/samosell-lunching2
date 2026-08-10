import Link from "next/link"
import { redirect } from "next/navigation"
import OrderCard from "@/components/orders/OrderCard"
import { requireAuthenticatedUser } from "@/lib/auth"
import {
  MARKETPLACE_ORDER_STATUSES,
  type MarketplaceOrder,
  type MarketplaceOrderRole,
} from "@/types/order"
import {
  ORDER_PAGE_SIZE,
  getOrdersPath,
  isMarketplaceOrderStatus,
  marketplaceOrderStatusLabel,
  parseOrderPage,
  parseOrderRoleFilter,
  parseOrderStatusFilter,
} from "@/lib/orders"

type OrdersSearchParams = {
  role?: string | string[]
  status?: string | string[]
  page?: string | string[]
}

const ORDER_SELECT = [
  "id",
  "listing_id",
  "buyer_id",
  "seller_id",
  "status",
  "listing_title",
  "listing_slug",
  "listing_cover_image_url",
  "item_price",
  "delivery_price",
  "platform_fee",
  "buyer_protection_fee",
  "total_amount",
  "currency",
  "delivery_method",
  "payment_provider",
  "provider_status",
  "created_at",
  "updated_at",
].join(", ")

function readParam(value?: string | string[]) {
  return typeof value === "string" ? value : ""
}

function resolveRole(order: MarketplaceOrder, userId: string): MarketplaceOrderRole | null {
  if (order.buyer_id === userId) return "buyer"
  if (order.seller_id === userId) return "seller"
  return null
}

export default async function DashboardOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<OrdersSearchParams>
}) {
  const params = (await searchParams) ?? {}
  const role = parseOrderRoleFilter(readParam(params.role))
  const status = parseOrderStatusFilter(readParam(params.status))
  const page = parseOrderPage(readParam(params.page))
  const rangeFrom = (page - 1) * ORDER_PAGE_SIZE
  const rangeTo = rangeFrom + ORDER_PAGE_SIZE - 1
  const { supabase, user } = await requireAuthenticatedUser(
    getOrdersPath({ role, status, page }),
  )

  let ordersQuery = supabase
    .from("marketplace_orders")
    .select(ORDER_SELECT, { count: "exact" })

  if (role === "buyer") ordersQuery = ordersQuery.eq("buyer_id", user.id)
  else if (role === "seller") ordersQuery = ordersQuery.eq("seller_id", user.id)
  else ordersQuery = ordersQuery.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)

  if (status !== "all") ordersQuery = ordersQuery.eq("status", status)
  ordersQuery = ordersQuery
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo)

  const allCountQuery = supabase
    .from("marketplace_orders")
    .select("id", { count: "exact", head: true })
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
  const buyerCountQuery = supabase
    .from("marketplace_orders")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", user.id)
  const sellerCountQuery = supabase
    .from("marketplace_orders")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", user.id)

  const [ordersResponse, ...countResponses] = await Promise.all([
    ordersQuery,
    allCountQuery,
    buyerCountQuery,
    sellerCountQuery,
  ])

  const queryError = ordersResponse.error || countResponses.find((item) => item.error)?.error
  if (queryError) {
    console.error("marketplace_orders_query_failed", queryError.message)
    throw new Error("MARKETPLACE_ORDERS_QUERY_FAILED")
  }

  const rawOrders = (ordersResponse.data ?? []) as unknown as Array<Omit<MarketplaceOrder, "status"> & { status: string }>
  if (rawOrders.some((order) => !isMarketplaceOrderStatus(order.status))) {
    console.error("marketplace_orders_invalid_status")
    throw new Error("MARKETPLACE_ORDERS_INVALID_STATUS")
  }

  const orders = rawOrders as MarketplaceOrder[]
  const totalCount = ordersResponse.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / ORDER_PAGE_SIZE))
  if (totalCount > 0 && page > totalPages) {
    redirect(getOrdersPath({ role, status, page: totalPages }))
  }

  const counts = {
    all: countResponses[0]?.count ?? 0,
    buyer: countResponses[1]?.count ?? 0,
    seller: countResponses[2]?.count ?? 0,
  }
  const accountIsEmpty = counts.all === 0

  return (
    <main className="min-h-screen bg-bg py-7 text-text sm:py-10">
      <div className="ui-container max-w-6xl">
        <header>
          <p className="ui-eyebrow">ყიდვა და გაყიდვა</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">ჩემი შეკვეთები</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-text-soft sm:text-base">
            აქ ჩანს მხოლოდ ის შეკვეთები, სადაც მყიდველი ან გამყიდველი შენ ხარ. ფასები შეკვეთის შექმნის მომენტში ინახება და მოგვიანებით განცხადების ცვლილება მათ არ ცვლის.
          </p>
        </header>

        <nav aria-label="შეკვეთების როლით გაფილტვრა" className="mt-7">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {([
              { value: "all", label: "ყველა" },
              { value: "buyer", label: "ვყიდულობ" },
              { value: "seller", label: "ვყიდი" },
            ] as const).map((item) => {
              const active = item.value === role
              return (
                <Link
                  key={item.value}
                  href={getOrdersPath({ role: item.value, status })}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-xl border px-4 py-2 text-sm font-bold transition ${active ? "border-brand bg-brand text-white" : "border-line bg-white text-text-soft hover:border-brand/40 hover:bg-brand-soft/40"}`}
                >
                  {item.label}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/15" : "bg-surface-alt"}`}>
                    {counts[item.value]}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>

        <form method="get" className="ui-card mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          {role !== "all" ? <input type="hidden" name="role" value={role} /> : null}
          <div className="min-w-0 flex-1">
            <label htmlFor="order-status-filter" className="mb-2 block text-sm font-bold text-text">
              სტატუსი
            </label>
            <select id="order-status-filter" name="status" defaultValue={status} className="ui-input">
              <option value="all">ყველა სტატუსი</option>
              {MARKETPLACE_ORDER_STATUSES.map((item) => (
                <option key={item} value={item}>{marketplaceOrderStatusLabel(item)}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="ui-btn-secondary">გაფილტვრა</button>
          {(status !== "all" || role !== "all") ? (
            <Link href="/dashboard/orders" className="ui-btn-ghost">გასუფთავება</Link>
          ) : null}
        </form>

        {orders.length > 0 ? (
          <>
            <section aria-label="ჩემი შეკვეთების სია" className="mt-6 space-y-4">
              {orders.map((order) => {
                const participantRole = resolveRole(order, user.id)
                return participantRole ? (
                  <OrderCard key={order.id} order={order} role={participantRole} />
                ) : null
              })}
            </section>

            {totalPages > 1 ? (
              <nav aria-label="შეკვეთების გვერდები" className="mt-8 flex items-center justify-center gap-3">
                {page > 1 ? (
                  <Link href={getOrdersPath({ role, status, page: page - 1 })} className="ui-btn-secondary">წინა</Link>
                ) : null}
                <span className="text-sm font-semibold text-text-soft">გვერდი {page} / {totalPages}</span>
                {page < totalPages ? (
                  <Link href={getOrdersPath({ role, status, page: page + 1 })} className="ui-btn-secondary">შემდეგი</Link>
                ) : null}
              </nav>
            ) : null}
          </>
        ) : (
          <section role="status" className="ui-card mt-6 border-dashed px-5 py-12 text-center sm:px-8 sm:py-16">
            <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-2xl text-brand">◎</div>
            <h2 className="mt-5 text-2xl font-black">
              {accountIsEmpty ? "შეკვეთები ჯერ არ გაქვს" : "ამ ფილტრით შეკვეთა არ მოიძებნა"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-soft">
              {accountIsEmpty
                ? "როდესაც უსაფრთხო checkout დასრულდება და შეკვეთაში მყიდველი ან გამყიდველი იქნები, ჩანაწერი აქ გამოჩნდება."
                : "შეცვალე როლი ან სტატუსი და ხელახლა გადაამოწმე სია."}
            </p>
            {accountIsEmpty ? (
              <Link href="/catalog" className="ui-btn-primary mt-7">კატალოგის ნახვა</Link>
            ) : (
              <Link href="/dashboard/orders" className="ui-btn-secondary mt-7">ყველა შეკვეთა</Link>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
