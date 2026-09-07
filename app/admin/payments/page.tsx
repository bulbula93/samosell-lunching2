import Link from "next/link"
import { reconcilePendingPaymentsAction } from "@/app/admin/payments/actions"
import StatCard from "@/components/shared/StatCard"
import { requireAdminUser } from "@/lib/auth"
import { formatDateOnly } from "@/lib/boosts"
import { refundStatusLabel } from "@/lib/payment-status"
import { createAdminClient } from "@/lib/supabase/admin"
import { tbcProviderStatusLabel } from "@/lib/tbc"

type Params = { page?: string | string[]; status?: string | string[]; q?: string | string[]; flash?: string | string[] }

type PaymentRow = {
  id: string; listing_id: string; seller_id: string; product_id: string; status: string
  amount: number; currency: string; payment_method: string; payment_provider: string | null
  provider_payment_id: string | null; provider_status: string | null; provider_result_code: string | null
  created_at: string; paid_at: string | null; last_payment_sync_at: string | null; cancelled_at: string | null
  failure_reason: string | null
  listings?: { title?: string | null; slug?: string | null } | null
  listing_boost_products?: { name?: string | null } | null
}

type RefundRow = { id: string; order_id: string; status: string; created_at: string }
type SellerRow = { id: string; username: string | null; full_name: string | null }

const tabs = [
  ["all", "ყველა"], ["pending", "მოლოდინში"], ["succeeded", "წარმატებული"], ["failed", "წარუმატებელი"],
  ["expired", "ვადაგასული"], ["returned", "დაბრუნებული"], ["partially_returned", "ნაწილობრივ დაბრუნებული"], ["refund", "Refund მოთხოვნა"],
] as const

function flashMessage(value: string) {
  const messages: Record<string, string> = {
    reconciled: "მოლოდინში მყოფი გადახდების გადამოწმება დასრულდა",
    reconcile_partial: "გადამოწმება დასრულდა, თუმცა რამდენიმე ჩანაწერი ხელით შემოწმებას საჭიროებს",
    reconcile_failed: "გადამოწმება ვერ შესრულდა",
    checkout_disabled: "TBC Checkout გამორთულია — ბანკის API-ზე მოთხოვნა არ გაგზავნილა",
    refund_approved: "შიდა refund მოთხოვნა დამტკიცდა; ბანკში თანხის დაბრუნება ავტომატურად არ დაწყებულა",
    refund_rejected: "Refund მოთხოვნა უარყოფილია",
    refund_reviewing: "Refund მოთხოვნა განხილვაშია",
    refund_unchanged: "Refund მოთხოვნის სტატუსი უკვე ასეთია",
    refund_invalid_state: "ამ refund სტატუსიდან მოქმედება დაუშვებელია",
  }
  return messages[value] ?? (value ? "ოპერაცია ვერ დასრულდა — გადაამოწმე მონაცემები" : "")
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams?: Promise<Params> }) {
  const params = (await searchParams) ?? {}
  const activeStatus = typeof params.status === "string" && tabs.some(([key]) => key === params.status) ? params.status : "all"
  const page = Math.floor(Math.max(1, Math.min(10000, Number(params.page) || 1)))
  const search = typeof params.q === "string" ? params.q.trim().toLowerCase().slice(0, 100) : ""
  const flash = typeof params.flash === "string" ? flashMessage(params.flash) : ""
  await requireAdminUser("/dashboard")
  const supabase = createAdminClient()

  const { data: rawOrders, error, count: total } = await supabase.rpc("search_admin_payment_orders", { p_query: search, p_status: activeStatus }, { count: "exact" }).select(`
      id, listing_id, seller_id, product_id, status, amount, currency, payment_method, payment_provider,
      provider_payment_id, provider_status, provider_result_code, created_at, paid_at, last_payment_sync_at,
      cancelled_at, failure_reason, listings(title, slug), listing_boost_products(name)
    `).range((page - 1) * 50, page * 50 - 1).returns<PaymentRow[]>()
  if (error) throw error
  if (rawOrders !== null && !Array.isArray(rawOrders)) throw new Error("Invalid payment search response")
  const { data: rawRefunds, error: refundError } = rawOrders?.length
    ? await supabase.from("listing_boost_refund_requests").select("id, order_id, status, created_at")
      .in("order_id", rawOrders.map((order: { id: string }) => order.id)).order("created_at", { ascending: false })
    : { data: [], error: null }
  if (refundError) throw refundError
  const orders = (rawOrders ?? []) as unknown as PaymentRow[]
  const refunds = (rawRefunds ?? []) as RefundRow[]
  const sellerIds = [...new Set(orders.map((order) => order.seller_id))]
  const { data: sellers, error: sellerError } = sellerIds.length
    ? await supabase.from("profiles").select("id, username, full_name").in("id", sellerIds)
    : { data: [] as SellerRow[], error: null }
  if (sellerError) throw sellerError
  const sellerMap = new Map((sellers ?? []).map((seller) => [seller.id, seller as SellerRow]))
  const refundMap = new Map<string, RefundRow>()
  for (const refund of refunds) if (!refundMap.has(refund.order_id)) refundMap.set(refund.order_id, refund)

  const visible = orders
  const [pendingResult, succeededResult, failedResult, returnedResult, refundResult, staleResult, lastSyncResult] = await Promise.all([
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).in("status", ["pending_payment","under_review","approved"]),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).or("provider_status.eq.Succeeded,status.eq.active"),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("provider_status", "Failed"),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).in("provider_status", ["Returned","PartialReturned"]),
    supabase.from("listing_boost_refund_requests").select("id", { count: "exact", head: true }).in("status", ["requested","under_review","approved","provider_processing"]),
    supabase.rpc("search_admin_payment_orders", { p_query: "", p_status: "stale" }, { count: "exact", head: true }),
    supabase.from("listing_boost_orders").select("last_payment_sync_at").not("last_payment_sync_at","is",null).order("last_payment_sync_at",{ascending:false}).limit(1),
  ])
  for (const result of [pendingResult,succeededResult,failedResult,returnedResult,refundResult,staleResult,lastSyncResult]) if (result.error) throw result.error
  const pending=pendingResult.count ?? 0, succeeded=succeededResult.count ?? 0, failed=failedResult.count ?? 0
  const returned=returnedResult.count ?? 0, openRefunds=refundResult.count ?? 0
  const pageHref = (value: number) => "/admin/payments?" + new URLSearchParams({ q: search, status: activeStatus, page: String(value) })

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="ui-eyebrow">Payments operations</div>
            <h1 className="mt-3 text-3xl font-black text-text sm:text-4xl">გადახდების მართვა</h1>
            <p className="mt-3 text-sm leading-7 text-text-soft">TBC და ხელით გადახდის შეკვეთები, provider სტატუსები, reconciliation და refund მოთხოვნები</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/payments/readiness" className="ui-btn-primary">TBC მზადყოფნა</Link>
            <Link href="/admin" className="ui-btn-secondary">ადმინის მთავარი</Link>
          </div>
        </div>
        <form action={reconcilePendingPaymentsAction} className="mt-5">
          <input type="hidden" name="nextPath" value="/admin/payments" />
          <button className="ui-btn-secondary">მოლოდინში მყოფი TBC გადახდების გადამოწმება</button>
        </form>
      </section>

      {flash ? <div className="mt-6 rounded-[1.2rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{flash}</div> : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="მოლოდინში" value={pending} /><StatCard label="წარმატებული" value={succeeded} />
        <StatCard label="წარუმატებელი" value={failed} /><StatCard label="დაბრუნებული" value={returned} />
        <StatCard label="ღია refund" value={openRefunds} />
      </section>

      <p className="mt-5 text-sm text-text-soft">30 წუთზე მეტი ხნის მოლოდინში: {staleResult.count ?? 0} · ბოლო სინქრონიზაცია: {lastSyncResult.data?.[0]?.last_payment_sync_at ? formatDateOnly(lastSyncResult.data[0].last_payment_sync_at) : "ჯერ არ ჩატარებულა"}</p>
      <form className="mt-6 flex flex-col gap-3 rounded-[1.5rem] border border-line bg-white p-4 sm:flex-row">
        <input name="q" defaultValue={search} className="ui-input" placeholder="Order ID, TBC Payment ID, განცხადება ან მომხმარებელი" />
        {activeStatus !== "all" ? <input type="hidden" name="status" value={activeStatus} /> : null}
        <button className="ui-btn-primary">მოძებნა</button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map(([key, label]) => <Link key={key} href={key === "all" ? "/admin/payments" : `/admin/payments?status=${key}`} className={activeStatus === key ? "ui-pill-soft" : "ui-pill"}>{label}</Link>)}
      </div>

      <section className="mt-6 space-y-4">
        {visible.length ? visible.map((order) => {
          const seller = sellerMap.get(order.seller_id)
          const refund = refundMap.get(order.id)
          return (
            <article key={order.id} className="ui-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-black text-text">{order.listing_boost_products?.name ?? order.product_id}</div>
                  <div className="mt-1 text-sm text-text-soft">{order.listings?.title ?? order.listing_id} · {order.amount} {order.currency === "GEL" ? "₾" : order.currency}</div>
                </div>
                <Link href={`/admin/payments/${order.id}`} className="ui-btn-secondary">დეტალები</Link>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                <div><strong>Order:</strong> <span className="break-all font-mono text-xs">{order.id}</span></div>
                <div><strong>Seller:</strong> {seller?.full_name || seller?.username || order.seller_id.slice(0, 8)}</div>
                <div><strong>Provider:</strong> {order.payment_provider ?? order.payment_method}</div>
                <div><strong>Internal:</strong> {order.status}</div>
                <div><strong>TBC Payment ID:</strong> <span className="break-all">{order.provider_payment_id || "—"}</span></div>
                <div><strong>სტატუსი:</strong> {tbcProviderStatusLabel(order.provider_status)}</div>
                <div><strong>შეიქმნა:</strong> {formatDateOnly(order.created_at)}</div>
                <div><strong>გადახდილია:</strong> {order.paid_at ? formatDateOnly(order.paid_at) : "—"}</div>
                <div><strong>ბოლო sync:</strong> {order.last_payment_sync_at ? formatDateOnly(order.last_payment_sync_at) : "—"}</div>
                <div><strong>Refund:</strong> {refundStatusLabel(refund?.status)}</div>
                {order.cancelled_at ? <div><strong>გაუქმდა:</strong> {formatDateOnly(order.cancelled_at)}</div> : null}
                {order.failure_reason ? <div className="text-red-800">{order.failure_reason}</div> : null}
              </div>
            </article>
          )
        }) : <div className="ui-card border-dashed p-8 text-sm text-text-soft">შესაბამისი გადახდა ვერ მოიძებნა</div>}
      </section>
      <nav className="mt-6 flex items-center gap-4" aria-label="გადახდების გვერდები">
        {page > 1 ? <Link className="ui-btn-secondary" href={pageHref(page-1)}>წინა</Link> : null}
        <span className="text-sm text-text-soft">გვერდი {page} · {total ?? 0} ჩანაწერი</span>
        {(total ?? 0) > page * 50 ? <Link className="ui-btn-secondary" href={pageHref(page+1)}>შემდეგი</Link> : null}
      </nav>
    </main>
  )
}
