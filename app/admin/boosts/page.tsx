export const dynamic = "force-dynamic"
export const revalidate = 0

import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import StatCard from "@/components/shared/StatCard"
import { adminReviewBoostOrderAction, refreshBoostOrderStatusAction } from "@/app/dashboard/boosts/actions"
import { boostStatusLabel, formatDateOnly, paymentMethodLabel, placementLabel } from "@/lib/boosts"
import { requireAdminUser } from "@/lib/auth"
import type { BoostOrder } from "@/types/boost"

type AdminBoostSearchParams = { status?: string | string[]; flash?: string | string[] }

type AdminBoostOrderRow = Omit<BoostOrder, "listing_title" | "listing_slug" | "cover_image_url" | "product_name" | "placement" | "duration_days" | "seller_username" | "seller_full_name"> & {
  listings?: { title?: string | null; slug?: string | null; cover_image_url?: string | null; featured_slot?: number | null } | null
  listing_boost_products?: { name?: string | null; placement?: string | null; duration_days?: number | null } | null
}

type SellerProfileLite = {
  id: string
  username?: string | null
  full_name?: string | null
}

const tabs = [
  { key: "all", label: "ყველა" },
  { key: "pending", label: "მოლოდინში" },
  { key: "active", label: "აქტიური" },
  { key: "rejected", label: "უარყოფილი" },
] as const

function flashLabel(value?: string) {
  switch (value) {
    case "activated": return "VIP განთავსება წარმატებით გააქტიურდა."
    case "rejected": return "მოთხოვნა უარყოფილია."
    case "reviewing": return "მოთხოვნა გადატანილია შემოწმების რეჟიმში."
    case "not_found": return "ჩანაწერი ვერ მოიძებნა."
    case "missing": return "აუცილებელი ველები აკლია."
    case "bad_product": return "არასწორი პროდუქტის კონფიგურაცია."
    case "tbc_sync_active": return "TBC სტატუსი განახლდა და boost უკვე აქტიურია."
    case "tbc_sync_pending": return "TBC სტატუსი განახლდა, მაგრამ გადახდა ჯერ ისევ პროცესშია."
    case "tbc_sync_failed": return "TBC სტატუსი განახლდა: გადახდა ვერ დასრულდა ან გაუქმდა."
    case "tbc_sync_missing": return "TBC შეკვეთა ვერ მოიძებნა."
    case "tbc_sync_unavailable": return "ამ ჩანაწერზე TBC სტატუსის გადამოწმება ხელმისაწვდომი არ არის."
    default: return value ? decodeURIComponent(value) : ""
  }
}

function mapStatusFilter(status: string) {
  switch (status) {
    case "pending": return ["pending_payment", "under_review", "approved"]
    case "active": return ["active"]
    case "rejected": return ["rejected", "cancelled"]
    default: return null
  }
}

export default async function AdminBoostsPage({ searchParams }: { searchParams?: Promise<AdminBoostSearchParams> }) {
  const params = (await searchParams) ?? {}
  const activeTab = typeof params.status === "string" ? params.status : "all"
  const flash = typeof params.flash === "string" ? flashLabel(params.flash) : ""

  const { supabase } = await requireAdminUser("/dashboard")

  let query = supabase.from("listing_boost_orders").select(`
      id,
      listing_id,
      seller_id,
      product_id,
      status,
      payment_method,
      payment_reference,
      amount,
      currency,
      payment_provider,
      provider_status,
      provider_result_code,
      checkout_session_started_at,
      last_payment_sync_at,
      paid_at,
      cancelled_at,
      failure_reason,
      notes,
      admin_note,
      starts_at,
      ends_at,
      approved_at,
      reviewed_by,
      created_at,
      updated_at,
      listings!inner(title, slug, cover_image_url, featured_slot),
      listing_boost_products!inner(name, placement, duration_days)
    `).order("created_at", { ascending: false })

  const statusFilter = mapStatusFilter(activeTab)
  if (statusFilter) query = query.in("status", statusFilter)

  const [{ data: orders }, { count: totalCount }, { count: pendingCount }, { count: activeCount }, { count: rejectedCount }] = await Promise.all([
    query,
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).in("status", ["pending_payment", "under_review", "approved"]),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).in("status", ["rejected", "cancelled"]),
  ])

  const orderRows = (orders ?? []) as AdminBoostOrderRow[]
  const sellerIds = Array.from(new Set(orderRows.map((item) => String(item.seller_id)).filter(Boolean)))
  const { data: sellers } = sellerIds.length > 0
    ? await supabase.from("profiles").select("id, username, full_name").in("id", sellerIds)
    : { data: [] as SellerProfileLite[] }

  const sellerMap = new Map<string, SellerProfileLite>((sellers ?? []).map((item) => [item.id, item]))
  const counts: Record<string, number> = { all: totalCount ?? 0, pending: pendingCount ?? 0, active: activeCount ?? 0, rejected: rejectedCount ?? 0 }
  const typedOrders = orderRows.map((item) => ({
    ...item,
    listing_title: item.listings?.title ?? null,
    listing_slug: item.listings?.slug ?? null,
    cover_image_url: item.listings?.cover_image_url ?? null,
    product_name: item.listing_boost_products?.name ?? null,
    placement: item.listing_boost_products?.placement ?? null,
    duration_days: item.listing_boost_products?.duration_days ?? null,
    seller_username: sellerMap.get(String(item.seller_id))?.username ?? null,
    seller_full_name: sellerMap.get(String(item.seller_id))?.full_name ?? null,
  })) as BoostOrder[]

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">ადმინისტრირება</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">VIP განთავსების მართვა</h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              აქედან ამოწმებ გადახდებს, ააქტიურებ VIP განთავსებას და აკონტროლებ ყველა მოთხოვნას, რომელსაც ხელით დამუშავება სჭირდება.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin" className="ui-btn-secondary">ადმინისტრირების მთავარი</Link>
            <Link href="/admin/reports" className="ui-btn-secondary">რეპორტები</Link>
          </div>
        </div>
      </section>

      {flash ? (
        <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{flash}</div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="სულ მოთხოვნები" value={counts.all ?? 0} />
        <StatCard label="მოლოდინში" value={counts.pending ?? 0} />
        <StatCard label="აქტიური" value={counts.active ?? 0} />
        <StatCard label="უარყოფილი" value={counts.rejected ?? 0} />
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/admin/boosts" : `/admin/boosts?status=${tab.key}`}
            className={activeTab === tab.key ? "ui-pill-soft" : "ui-pill"}
          >
            {tab.label} ({counts[tab.key] ?? 0})
          </Link>
        ))}
      </div>

      <section className="mt-6 space-y-5">
        {typedOrders.length > 0 ? typedOrders.map((order) => (
          <article key={order.id} className="ui-card p-5 sm:p-6">
            <div className="grid gap-5 xl:grid-cols-[112px_minmax(0,1fr)_360px]">
              <div className="aspect-[4/5] overflow-hidden rounded-[1.2rem] bg-surface-alt">
                <SmartImage src={order.cover_image_url} alt={order.listing_title || "განცხადება"} wrapperClassName="h-full w-full" fallbackLabel="სურათი არ არის" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-lg font-bold text-text">{order.product_name || order.product_id}</div>
                  <span className="ui-pill !px-3 !py-1 text-xs">{boostStatusLabel(order.status, order.ends_at)}</span>
                </div>
                <div className="mt-1 text-sm text-text-soft">{placementLabel(order.placement)} · {order.amount} {order.currency === "GEL" ? "₾" : order.currency}</div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">განცხადება:</span> {order.listing_title || "—"}</div>
                  <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">გამყიდველი:</span> {order.seller_full_name || order.seller_username || "—"}</div>
                  <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">შეიქმნა:</span> {formatDateOnly(order.created_at)}</div>
                  <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">გადახდა:</span> {paymentMethodLabel(order.payment_method)}</div>
                  <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">რეფერენსი:</span> {order.payment_reference || "—"}</div>
                  <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">აქტიურია სანამ:</span> {order.ends_at ? formatDateOnly(order.ends_at) : "—"}</div>
                  {order.payment_provider ? <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">არხი:</span> {order.payment_provider}</div> : null}
                  {order.provider_status ? <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">TBC სტატუსი:</span> {order.provider_status}</div> : null}
                  {order.checkout_session_started_at ? <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">Checkout დაიწყო:</span> {formatDateOnly(order.checkout_session_started_at)}</div> : null}
                  {order.last_payment_sync_at ? <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">ბოლო სინქი:</span> {formatDateOnly(order.last_payment_sync_at)}</div> : null}
                  {order.paid_at ? <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">გადახდილია:</span> {formatDateOnly(order.paid_at)}</div> : null}
                  {order.cancelled_at ? <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">გაუქმდა:</span> {formatDateOnly(order.cancelled_at)}</div> : null}
                </div>

                {order.failure_reason ? <div className="mt-3 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">TBC მიზეზი: {order.failure_reason}</div> : null}
                {order.notes ? <div className="mt-3 rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">გამყიდველის შენიშვნა: {order.notes}</div> : null}
                {order.admin_note ? <div className="mt-3 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ადმინის შენიშვნა: {order.admin_note}</div> : null}
              </div>

              <div className="space-y-3">
                {order.payment_provider === "tbc_checkout" ? (
                  <form action={refreshBoostOrderStatusAction} className="rounded-[1.25rem] border border-sky-200 bg-sky-50 p-4">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="nextPath" value={activeTab === "all" ? "/admin/boosts" : `/admin/boosts?status=${activeTab}`} />
                    <input type="hidden" name="mode" value="admin" />
                    <div className="text-sm font-semibold text-sky-900">TBC status sync</div>
                    <p className="mt-2 text-sm leading-6 text-sky-900/80">თუ callback დაგვიანდა ან seller ამბობს რომ უკვე გადაიხადა, აქედან გადაამოწმე provider სტატუსი ხელით.</p>
                    <button className="mt-3 ui-btn-secondary border-sky-300 text-sky-900 hover:bg-white">სტატუსის გადამოწმება</button>
                  </form>
                ) : null}

                <form action={adminReviewBoostOrderAction} className="rounded-[1.25rem] border border-line bg-surface-alt p-4">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="nextPath" value={activeTab === "all" ? "/admin/boosts" : `/admin/boosts?status=${activeTab}`} />
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text">ადმინის შენიშვნა</label>
                    <textarea name="adminNote" className="min-h-24 w-full rounded-[1rem] border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-soft/70" placeholder="მაგ: გადახდა დადასტურდა" />
                  </div>
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-semibold text-text">მთავარ ბლოკში პოზიცია</label>
                    <input name="featuredSlot" type="number" min="1" className="ui-input" placeholder="მაგ: 1" />
                    <div className="mt-2 text-xs leading-5 text-text-soft">შეავსე მხოლოდ მაშინ, როცა განცხადება მთავარ ბლოკში უნდა გამოჩნდეს კონკრეტულ ადგილზე.</div>
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <button name="decision" value="review" className="ui-btn-secondary">შემოწმება</button>
                    <button name="decision" value="reject" className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50">უარყოფა</button>
                    <button name="decision" value="activate" className="ui-btn-primary">გააქტიურება</button>
                  </div>
                </form>
              </div>
            </div>
          </article>
        )) : <div className="ui-card border-dashed px-6 py-10 text-sm text-text-soft">ამ ფილტრში VIP განთავსების მოთხოვნა ვერ მოიძებნა.</div>}
      </section>
    </main>
  )
}
