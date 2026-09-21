import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import SmartImage from "@/components/shared/SmartImage"
import { requireAuthenticatedUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 0

type AdOrderRow = {
  id: string
  ad_id: string
  status: string
  amount: number | string
  currency: string
  product_name_snapshot: string
  duration_days_snapshot: number
  paid_at: string | null
  starts_at: string | null
  ends_at: string | null
  selected_placement: string | null
  created_at: string
}

type AdRow = {
  id: string
  title: string | null
  description: string | null
  advertiser_name: string | null
  image_url: string | null
  target_url: string | null
  review_status: string
  is_active: boolean
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tbilisi",
  }).format(date)
}

function statusLabel(order: AdOrderRow) {
  const now = Date.now()
  const starts = order.starts_at ? Date.parse(order.starts_at) : null
  const ends = order.ends_at ? Date.parse(order.ends_at) : null

  if (ends && Number.isFinite(ends) && ends <= now) return "დასრულებულია"
  if (starts && Number.isFinite(starts) && starts > now && ["scheduled", "active"].includes(order.status)) return "დაგეგმილია"

  switch (order.status) {
    case "pending_payment": return "გადახდა მოლოდინშია"
    case "payment_failed": return "გადახდა ვერ დაიწყო"
    case "paid_pending_review": return "გადახდილია · მოდერაციაზეა"
    case "scheduled": return "დაგეგმილია"
    case "active": return "აქტიურია"
    case "expired": return "დასრულებულია"
    case "reversed": return "გადახდა დაბრუნებულია"
    case "cancelled": return "გაუქმებულია"
    default: return order.status
  }
}

function statusClass(order: AdOrderRow) {
  if (order.status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (order.status === "paid_pending_review" || order.status === "scheduled") return "border-sky-200 bg-sky-50 text-sky-800"
  if (order.status === "payment_failed" || order.status === "cancelled") return "border-red-200 bg-red-50 text-red-800"
  return "border-neutral-200 bg-neutral-100 text-neutral-700"
}

export default async function DashboardAdsPage() {
  const { supabase, user } = await requireAuthenticatedUser("/dashboard/ads")
  const { data: orderData, error } = await supabase
    .from("ad_orders")
    .select("id, ad_id, status, amount, currency, product_name_snapshot, duration_days_snapshot, paid_at, starts_at, ends_at, selected_placement, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const orders = (orderData ?? []) as AdOrderRow[]
  const adIds = orders.map((order) => order.ad_id)
  const admin = createAdminClient()

  const [{ data: adData }, { data: eventData }] = adIds.length > 0
    ? await Promise.all([
        admin
          .from("ads")
          .select("id, title, description, advertiser_name, image_url, target_url, review_status, is_active")
          .in("id", adIds),
        admin
          .from("ad_events")
          .select("ad_id, event_type")
          .in("ad_id", adIds),
      ])
    : [{ data: [] }, { data: [] }]

  const ads = new Map(((adData ?? []) as AdRow[]).map((ad) => [ad.id, ad]))
  const stats = new Map<string, { impressions: number; clicks: number }>()
  for (const event of (eventData ?? []) as Array<{ ad_id: string; event_type: string }>) {
    const current = stats.get(event.ad_id) ?? { impressions: 0, clicks: 0 }
    if (event.event_type === "impression") current.impressions += 1
    if (event.event_type === "click") current.clicks += 1
    stats.set(event.ad_id, current)
  }

  return (
    <main className="min-h-screen bg-bg text-text">
      <SiteHeader />
      <section className="ui-container py-10 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="ui-eyebrow">რეკლამები</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">ჩემი რეკლამები</h1>
            <p className="mt-3 text-sm leading-7 text-text-soft">
              აქ ხედავ გადახდას, მოდერაციას, დაწყების/დასრულების დროს და რეალურ ნახვა/დაჭერებს.
            </p>
          </div>
          <Link href="/advertise" className="ui-btn-primary">ახალი რეკლამა</Link>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            რეკლამების ისტორია ვერ ჩაიტვირთა.
          </div>
        ) : null}

        <div className="mt-7 space-y-4">
          {orders.map((order) => {
            const ad = ads.get(order.ad_id)
            const eventCount = stats.get(order.ad_id) ?? { impressions: 0, clicks: 0 }
            const ctr = eventCount.impressions > 0
              ? ((eventCount.clicks / eventCount.impressions) * 100).toFixed(1)
              : "0.0"

            return (
              <article key={order.id} className="ui-card overflow-hidden p-5 sm:p-6">
                <div className="grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <SmartImage
                    src={ad?.image_url}
                    alt={ad?.title || "რეკლამა"}
                    wrapperClassName="aspect-square w-full overflow-hidden rounded-[1.2rem] border border-line bg-surface-alt"
                    className="object-cover"
                    fallbackLabel="სურათი არ არის"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(order)}`}>
                        {statusLabel(order)}
                      </span>
                      <span className="text-xs font-semibold text-text-soft">
                        {Number(order.amount).toFixed(2)} {order.currency === "GEL" ? "₾" : order.currency}
                      </span>
                    </div>

                    <h2 className="mt-3 text-xl font-black text-text">{ad?.title || order.product_name_snapshot}</h2>
                    <p className="mt-1 text-sm font-semibold text-brand">{ad?.advertiser_name || "SamoSell Brand Ad"}</p>
                    {ad?.target_url ? <p className="mt-2 break-all text-xs text-text-soft">{ad.target_url}</p> : null}

                    <dl className="mt-4 grid gap-2 text-xs text-text-soft sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl bg-surface-alt px-3 py-2">
                        <dt className="font-semibold text-text">დაწყება</dt>
                        <dd className="mt-1">{formatDate(order.starts_at)}</dd>
                      </div>
                      <div className="rounded-xl bg-surface-alt px-3 py-2">
                        <dt className="font-semibold text-text">დასრულება</dt>
                        <dd className="mt-1">{formatDate(order.ends_at)}</dd>
                      </div>
                      <div className="rounded-xl bg-surface-alt px-3 py-2">
                        <dt className="font-semibold text-text">ჩვენება</dt>
                        <dd className="mt-1 text-base font-black text-brand">{eventCount.impressions}</dd>
                      </div>
                      <div className="rounded-xl bg-surface-alt px-3 py-2">
                        <dt className="font-semibold text-text">დაჭერა / CTR</dt>
                        <dd className="mt-1 text-base font-black text-brand">{eventCount.clicks} / {ctr}%</dd>
                      </div>
                    </dl>

                    {order.status === "payment_failed" ? (
                      <div className="mt-4">
                        <Link href="/advertise" className="ui-btn-secondary">ხელახლა შექმნა</Link>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}

          {orders.length === 0 ? (
            <div className="ui-card border-dashed px-6 py-12 text-center">
              <h2 className="text-xl font-black">რეკლამა ჯერ არ შეგიქმნია</h2>
              <p className="mt-2 text-sm text-text-soft">შექმენი ბრენდული რეკლამა და მიაბი შენი SamoSell მაღაზია ან სოციალური გვერდი.</p>
              <Link href="/advertise" className="ui-btn-primary mt-5">რეკლამის შექმნა</Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
