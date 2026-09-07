import Link from "next/link"
import { notFound } from "next/navigation"
import { reviewBoostRefundAction } from "@/app/admin/payments/actions"
import { refreshBoostOrderStatusAction } from "@/app/dashboard/boosts/actions"
import { requireAdminUser } from "@/lib/auth"
import { formatDateOnly } from "@/lib/boosts"
import { refundStatusLabel } from "@/lib/payment-status"
import { createAdminClient } from "@/lib/supabase/admin"
import { tbcProviderStatusLabel, isTbcCheckoutEnabled } from "@/lib/tbc"

type PageProps = { params: Promise<{ orderId: string }>; searchParams?: Promise<{ flash?: string | string[] }> }

function flashLabel(value?: string) {
  switch (value) {
    case "checkout_disabled": return "Prepared — live TBC checkout disabled"
    case "reconciled": return "TBC სტატუსი განახლებულია"
    case "reconcile_partial": return "ნაწილი განახლდა, ნაწილი დამატებით შემოწმებას საჭიროებს"
    case "reconcile_failed": return "TBC სტატუსის განახლება ვერ შესრულდა"
    case "refund_reviewing": return "დაბრუნების მოთხოვნა განხილვაშია"
    case "refund_approved": return "შიდა დაბრუნების მოთხოვნა დამტკიცებულია; ბანკის მოქმედება ჯერ არ დაწყებულა"
    case "refund_rejected": return "დაბრუნების მოთხოვნა უარყოფილია"
    case "refund_unchanged": return "სტატუსი უკვე ამ მდგომარეობაშია"
    case "refund_invalid_state": return "ამ მდგომარეობიდან მოთხოვნის შეცვლა დაუშვებელია"
    case "refund_review_failed": return "დაბრუნების მოთხოვნის განახლება ვერ შესრულდა"
    default: return value ? "ოპერაციის შედეგი მიღებულია" : ""
  }
}

export default async function AdminPaymentDetailPage({ params, searchParams }: PageProps) {
  const { orderId } = await params
  const query = (await searchParams) ?? {}
  const flash = typeof query.flash === "string" ? flashLabel(query.flash) : ""
  await requireAdminUser("/dashboard")
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) notFound()
  const supabase = createAdminClient()
  const { data: order, error } = await supabase.from("listing_boost_orders").select(`
    id, listing_id, seller_id, product_id, status, payment_method, payment_reference, amount, currency,
    payment_provider, provider_payment_id, provider_status, provider_result_code, checkout_session_started_at,
    last_payment_sync_at, paid_at, cancelled_at, failure_reason, notes, admin_note, starts_at, ends_at,
    approved_at, created_at, updated_at, listings(title, slug), listing_boost_products(name, placement, duration_days)
  `).eq("id", orderId).maybeSingle()
  if (error) throw error
  if (!order) notFound()

  const [{ data: events }, { data: refunds }, { data: seller }] = await Promise.all([
    supabase.from("listing_boost_order_events").select("id, source, event_type, provider_status, provider_result_code, message, created_at").eq("order_id", order.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("listing_boost_refund_requests").select("id, status, amount, currency, reason, admin_note, requested_at, reviewed_at, completed_at, provider_reference").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("username, full_name").eq("id", order.seller_id).maybeSingle(),
  ])
  const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings
  const product = Array.isArray(order.listing_boost_products) ? order.listing_boost_products[0] : order.listing_boost_products
  const nextPath = `/admin/payments/${order.id}`

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="ui-eyebrow">Payment detail</div>
            <h1 className="mt-3 text-3xl font-black text-text">{product?.name ?? order.product_id}</h1>
            <p className="mt-2 break-all font-mono text-xs text-text-soft">{order.id}</p>
          </div>
          <div className="flex flex-wrap gap-3"><Link href="/admin/payments" className="ui-btn-secondary">გადახდებზე დაბრუნება</Link>{listing?.slug ? <Link href={`/listing/${listing.slug}`} className="ui-btn-secondary">განცხადება</Link> : null}{seller?.username ? <Link href={`/seller/${seller.username}`} className="ui-btn-secondary">გამყიდველი</Link> : null}</div>
        </div>
      </section>

      {flash ? <div className="mt-6 rounded-[1.2rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{flash}</div> : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="ui-card p-5">
            <h2 className="text-xl font-black text-text">შეკვეთის შეჯამება</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-text-soft">განცხადება</dt><dd className="font-semibold">{listing?.title ?? order.listing_id}</dd></div>
              <div><dt className="text-text-soft">გამყიდველი</dt><dd className="font-semibold">{seller?.full_name || seller?.username || order.seller_id}</dd></div>
              <div><dt className="text-text-soft">თანხა</dt><dd className="font-semibold">{order.amount} {order.currency}</dd></div>
              <div><dt className="text-text-soft">მეთოდი</dt><dd className="font-semibold">{order.payment_provider ?? order.payment_method}</dd></div>
              <div><dt className="text-text-soft">TBC Payment ID</dt><dd className="break-all font-mono text-xs">{order.provider_payment_id ?? "—"}</dd></div>
              <div><dt className="text-text-soft">Provider სტატუსი</dt><dd className="font-semibold">{tbcProviderStatusLabel(order.provider_status)}</dd></div>
              <div><dt className="text-text-soft">Internal სტატუსი</dt><dd className="font-semibold">{order.status}</dd></div>
              <div><dt className="text-text-soft">შეიქმნა</dt><dd>{formatDateOnly(order.created_at)}</dd></div>
              <div><dt className="text-text-soft">გადახდილია</dt><dd>{order.paid_at ? formatDateOnly(order.paid_at) : "—"}</dd></div>
              <div><dt className="text-text-soft">ბოლო sync</dt><dd>{order.last_payment_sync_at ? formatDateOnly(order.last_payment_sync_at) : "—"}</dd></div>
              <div><dt className="text-text-soft">გაუქმდა</dt><dd>{order.cancelled_at ? formatDateOnly(order.cancelled_at) : "—"}</dd></div>
              <div><dt className="text-text-soft">Provider result code</dt><dd>{order.provider_result_code || "—"}</dd></div>
            </dl>
            {order.failure_reason ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{order.failure_reason}</p> : null}
          </div>

          <div className="ui-card p-5">
            <h2 className="text-xl font-black text-text">Audit trail</h2>
            <div className="mt-4 space-y-3">
              {(events ?? []).length ? (events ?? []).map((event) => <div key={event.id} className="rounded-xl bg-surface-alt p-3 text-sm"><div className="font-bold text-text">{event.event_type} · {event.source}</div><div className="mt-1 text-text-soft">{event.message || "—"}</div><div className="mt-1 text-xs text-text-soft">{formatDateOnly(event.created_at)} · {event.provider_status || "no provider state"}</div></div>) : <p className="text-sm text-text-soft">Audit event ჯერ არ არის</p>}
            </div>
          </div>

          <div className="ui-card p-5">
            <h2 className="text-xl font-black text-text">Refund / dispute</h2>
            <div className="mt-4 space-y-4">
              {(refunds ?? []).length ? (refunds ?? []).map((refund) => (
                <article key={refund.id} className="rounded-xl border border-line p-4">
                  <div className="font-bold text-text">{refundStatusLabel(refund.status)} · {refund.amount} {refund.currency}</div>
                  <p className="mt-2 text-sm text-text-soft">{refund.reason}</p>
                  {refund.admin_note ? <p className="mt-2 text-sm text-text-soft">ადმინის შენიშვნა: {refund.admin_note}</p> : null}
                  {["requested", "under_review"].includes(refund.status) ? <form action={reviewBoostRefundAction} className="mt-4 space-y-3"><input type="hidden" name="refundId" value={refund.id} /><input type="hidden" name="nextPath" value={nextPath} /><textarea name="adminNote" className="ui-input min-h-24" placeholder="ადმინის შენიშვნა" /><div className="flex flex-wrap gap-2"><button name="decision" value="review" className="ui-btn-secondary">განხილვა</button><button name="decision" value="reject" className="ui-btn-secondary">უარყოფა</button><button name="decision" value="approve" className="ui-btn-primary">შიდა მოთხოვნის დამტკიცება</button></div><p className="text-xs text-text-soft">დამტკიცება ბანკში თანხის დაბრუნებას არ იწყებს</p></form> : null}
                </article>
              )) : <p className="text-sm text-text-soft">Refund მოთხოვნა არ არის</p>}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          {isTbcCheckoutEnabled() && order.payment_provider === "tbc_checkout" && order.provider_payment_id ? <form action={refreshBoostOrderStatusAction} className="ui-card p-5"><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="nextPath" value={nextPath} /><input type="hidden" name="mode" value="admin" /><h2 className="font-black text-text">Provider status</h2><p className="mt-2 text-sm leading-6 text-text-soft">სტატუსი ყოველთვის TBC API-დან მოწმდება</p><button className="ui-btn-primary mt-4">სტატუსის განახლება</button></form> : null}
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">აქ არ არსებობს „force paid“ ან provider სტატუსის ხელით ჩასწორება</div>
        </aside>
      </section>
    </main>
  )
}
