import { requireAuthenticatedUser } from "@/lib/auth"
import { refreshBoostOrderStatusAction } from "@/app/dashboard/boosts/actions"
import { requestBoostRefundAction } from "@/app/dashboard/billing/actions"
import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import { boostProductName, boostStatusLabel, formatDateOnly, paymentMethodLabel } from "@/lib/boosts"
import { reconcileExpiredBoostOrders } from "@/lib/boost-reconciliation"
import { getBoostPaymentConfig } from "@/lib/boost-payment-config"
import { isRefundRequestEligible, refundStatusLabel } from "@/lib/payment-status"
import { tbcProviderStatusLabel } from "@/lib/tbc"
import type { BoostOrder } from "@/types/boost"

type BillingSearchParams = { status?: string | string[]; flash?: string | string[] }

type BillingBoostOrderRow = Omit<BoostOrder, "listing_title" | "listing_slug" | "cover_image_url" | "product_name" | "placement" | "duration_days"> & {
  listings?: { title?: string | null; slug?: string | null; cover_image_url?: string | null } | null
  listing_boost_products?: { name?: string | null; placement?: string | null; duration_days?: number | null } | null
}

const tabs = [
  { key: "all", label: "ყველა" },
  { key: "pending", label: "მოლოდინში" },
  { key: "active", label: "აქტიური" },
  { key: "completed", label: "დასრულებული" },
  { key: "rejected", label: "უარყოფილი" },
] as const

function flashLabel(value?: string) {
  switch (value) {
    case "tbc_activated":
      return "TBC Checkout გადახდა დადასტურდა და VIP განთავსება ავტომატურად გააქტიურდა."
    case "tbc_success":
      return "TBC Checkout გადახდა დაფიქსირდა. თუ აქტივაცია ჯერ არ ჩანს, გვერდი კიდევ ერთხელ გადაამოწმე რამდენიმე წამში."
    case "tbc_failed":
      return "TBC Checkout გადახდა ვერ შესრულდა. შეგიძლია თავიდან სცადო იგივე ბმულიდან."
    case "tbc_expired":
      return "TBC Checkout სესია ვადაგასულია. შეგიძლია გადახდა ხელახლა დაიწყო."
    case "tbc_pending":
      return "გადახდის სტატუსი ჯერ საბოლოოდ არ დადასტურებულა. რამდენიმე წამში გადაამოწმე ისევ."
    case "tbc_error":
      return "TBC გადახდის შემოწმებისას დაფიქსირდა შეცდომა."
    case "tbc_missing_order":
      return "გადახდის დაბრუნების ბმული არასრულია."
    case "tbc_sync_active":
      return "სტატუსი განახლდა: გადახდა დადასტურდა და boost უკვე აქტიურია."
    case "tbc_sync_pending":
      return "სტატუსი განახლდა, მაგრამ გადახდა ჯერ ისევ დამუშავების პროცესშია."
    case "tbc_sync_failed":
      return "სტატუსი განახლდა: TBC გადახდა ვერ დასრულდა ან გაუქმდა."
    case "tbc_sync_missing":
      return "შესაბამისი TBC შეკვეთა ვერ მოიძებნა."
    case "tbc_sync_unavailable":
      return "ამ შეკვეთაზე TBC სტატუსის გადამოწმება ხელმისაწვდომი არ არის."
    case "tbc_disabled":
      return "TBC ბარათით გადახდა მალე იქნება ხელმისაწვდომი"
    case "tbc_returned": return "თანხა დაბრუნებულია"
    case "tbc_partially_returned": return "თანხა ნაწილობრივ დაბრუნებულია"
    case "tbc_cancelled": return "გადახდის გაუქმება მუშავდება"
    case "refund_requested":
      return "თანხის დაბრუნების მოთხოვნა მიღებულია და განხილვას ელოდება"
    case "refund_already_open":
      return "ამ შეკვეთაზე თანხის დაბრუნების აქტიური მოთხოვნა უკვე არსებობს"
    case "refund_not_eligible":
      return "ამ შეკვეთაზე თანხის დაბრუნების მოთხოვნა ხელმისაწვდომი არ არის"
    case "refund_invalid_reason":
      return "მიუთითე დაბრუნების მიზეზი მინიმუმ 10 სიმბოლოთი"
    case "refund_request_failed":
      return "თანხის დაბრუნების მოთხოვნა ვერ შეინახა. სცადე მოგვიანებით"
    default:
      return value || ""
  }
}

function mapStatusFilter(status: string) {
  switch (status) {
    case "pending": return ["pending_payment", "under_review", "approved"]
    case "active": return ["active"]
    case "completed": return ["expired"]
    case "rejected": return ["rejected", "cancelled"]
    default: return null
  }
}

export default async function DashboardBillingPage({ searchParams }: { searchParams?: Promise<BillingSearchParams> }) {
  const params = (await searchParams) ?? {}
  const activeTab = typeof params.status === "string" ? params.status : "all"
  const flash = typeof params.flash === "string" ? flashLabel(params.flash) : ""
  const payment = getBoostPaymentConfig()

  const { supabase, user } = await requireAuthenticatedUser("/dashboard/billing")
  await reconcileExpiredBoostOrders()

  let ordersQuery = supabase.from("listing_boost_orders").select(`
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
      provider_payment_id,
      provider_checkout_url,
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
      listings!inner(title, slug, cover_image_url),
      listing_boost_products!inner(name, placement, duration_days)
    `).eq("seller_id", user.id).order("created_at", { ascending: false })

  const filter = mapStatusFilter(activeTab)
  if (filter) ordersQuery = ordersQuery.in("status", filter)

  const nowIso = new Date().toISOString()
  const [{ data: orders }, { count: totalCount }, { count: pendingCount }, { count: activeCount }, { count: completedCount }, { count: rejectedCount }, { data: refunds }] = await Promise.all([
    ordersQuery,
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("seller_id", user.id),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("seller_id", user.id).in("status", ["pending_payment", "under_review", "approved"]),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "active").gt("ends_at", nowIso),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "expired"),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("seller_id", user.id).in("status", ["rejected", "cancelled"]),
    supabase.from("listing_boost_refund_requests").select("id, order_id, status, created_at").eq("seller_id", user.id).order("created_at", { ascending: false }),
  ])

  const counts: Record<string, number> = { all: totalCount ?? 0, pending: pendingCount ?? 0, active: activeCount ?? 0, completed: completedCount ?? 0, rejected: rejectedCount ?? 0 }
  const orderRows = (orders ?? []) as BillingBoostOrderRow[]
  const typedOrders = orderRows.map((item) => ({
    ...item,
    listing_title: item.listings?.title ?? null,
    listing_slug: item.listings?.slug ?? null,
    cover_image_url: item.listings?.cover_image_url ?? null,
    product_name: item.listing_boost_products?.name ?? null,
    placement: item.listing_boost_products?.placement ?? null,
    duration_days: item.listing_boost_products?.duration_days ?? null,
  })) as BoostOrder[]

  const pendingOrders = typedOrders.filter((order) => ["pending_payment", "under_review", "approved"].includes(order.status))
  const refundMap = new Map<string, { id: string; status: string }>()
  for (const refund of refunds ?? []) if (!refundMap.has(refund.order_id)) refundMap.set(refund.order_id, refund)

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">გადახდები</div>
          <h1 className="mt-3 text-4xl font-black">გაძლიერებები და გადახდები</h1>
          <p className="mt-3 max-w-2xl text-neutral-600">აქ ჩანს VIP, TOP, VIP MAX და მთავარი გვერდის ბანერის ყველა შეკვეთა — თანხა, გადახდა, აქტივაცია და მოქმედების ვადა.</p>
        </div>
        <Link href="/dashboard/listings" className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">განცხადებების მართვა</Link>
      </div>

      {pendingOrders.length > 0 ? (
        <section className="mb-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-800">საყურადღებო</div>
          <h2 className="mt-2 text-2xl font-black text-amber-950">დარჩენილი მოთხოვნები</h2>
          <div className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
            <p>აქტიური მოლოდინის რეჟიმში მყოფი მოთხოვნები: <span className="font-bold">{pendingOrders.length}</span></p>
            <p>გამოიყენე შესაბამისი payment reference გადახდის დანიშნულებაში და დაელოდე დადასტურებას. TBC Checkout წარმატებული გადახდები ავტომატურად აქტიურდება, ხოლო ხელით დამუშავებადი მეთოდები მუშავდება დაახლოებით {payment.approvalTime}-ში.</p>
            <p>თუ გადახდა უკვე გააკეთე და სტატუსი ჯერ არ შეცვლილა, მოგვწერე <a href={`mailto:${payment.paymentContactEmail}`} className="font-semibold underline underline-offset-4">{payment.paymentContactEmail}</a>-ზე.</p>
          </div>
        </section>
      ) : null}

      {flash ? <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{flash}</div> : null}

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">როგორ მუშაობს</div>
          <div className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
            <p>1. განცხადების VIP განთავსების გვერდიდან ქმნი ახალ მოთხოვნას.</p>
            <p>2. აქ ამოწმებ შეკვეთას და მის რეფერენსს.</p>
            <p>3. იხდი ხელმისაწვდომი გადახდის მეთოდით.</p>
            <p>4. {payment.tbcCheckoutEnabled ? "წარმატებული TBC Checkout გადახდის შემდეგ VIP განთავსება ავტომატურად აქტიურდება" : "TBC ბარათით გადახდა მალე იქნება ხელმისაწვდომი"}, ხელით მეთოდებზე კი დადასტურება მოდერატორის მხრიდან ხდება.</p>
          </div>
        </div>
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">გადახდის მონაცემები</div>
          <div className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
            {payment.bankName ? <p>ბანკი: <span className="font-semibold text-neutral-900">{payment.bankName}</span></p> : null}
            {payment.accountHolder ? <p>მიმღები: <span className="font-semibold text-neutral-900">{payment.accountHolder}</span></p> : null}
            {payment.accountNumber ? <p>IBAN / ანგარიში: <span className="font-mono text-xs text-neutral-900 sm:text-sm">{payment.accountNumber}</span></p> : null}
            {payment.hasExternalPaymentUrl ? (
              <p>
                <a href={payment.externalPaymentUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">
                  გარე გადახდის ბმულის გახსნა
                </a>
              </p>
            ) : null}
            <p>{payment.note}</p>
          </div>
        </div>
      </section>

      <div className="mb-6 flex flex-wrap gap-3">
        {tabs.map((tab) => <Link key={tab.key} href={tab.key === "all" ? "/dashboard/billing" : `/dashboard/billing?status=${tab.key}`} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab.key ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}>{tab.label} ({counts[tab.key] ?? 0})</Link>)}
      </div>

      <div className="space-y-4">
        {typedOrders.length > 0 ? typedOrders.map((order) => (
          <div key={order.id} className="grid gap-4 rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm lg:grid-cols-[120px_1fr_auto] lg:items-center">
            <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-100"><SmartImage src={order.cover_image_url} alt={order.listing_title || "განცხადება"} wrapperClassName="h-full w-full" fallbackLabel="სურათი არ არის" /></div>
            <div>
              <div className="text-lg font-bold text-neutral-900">{boostProductName(order.product_name, order.placement)}</div>
              <div className="mt-1 text-sm text-neutral-500">{order.amount} {order.currency === "GEL" ? "₾" : order.currency}</div>
              <div className="mt-1 text-sm text-neutral-500">განცხადება: {order.listing_title || "—"}</div>
              <div className="mt-3 grid gap-2 text-sm text-neutral-600 md:grid-cols-2">
                <div>თანხა: <span className="font-medium text-neutral-900">{order.amount} {order.currency === "GEL" ? "₾" : order.currency}</span></div>
                <div>გადახდის მეთოდი: {paymentMethodLabel(order.payment_method)}</div>
                <div>რეფერენსი: <span className="font-medium text-neutral-900">{order.payment_reference || "—"}</span></div>
                <div>აქტივაციის სტატუსი: <span className="font-medium text-neutral-900">{boostStatusLabel(order.status, order.ends_at)}</span></div>
                <div>დაწყება: {order.starts_at ? formatDateOnly(order.starts_at) : "—"}</div>
                <div>დასრულება: {order.ends_at ? formatDateOnly(order.ends_at) : "—"}</div>
                {order.provider_status ? <div>გადახდის სტატუსი (TBC): <span className="font-medium text-neutral-900">{tbcProviderStatusLabel(order.provider_status)}</span></div> : <div>გადახდის სტატუსი: <span className="font-medium text-neutral-900">{order.approved_at ? "დადასტურებული" : "მოლოდინში"}</span></div>}
                {order.checkout_session_started_at ? <div>Checkout დაიწყო: {formatDateOnly(order.checkout_session_started_at)}</div> : null}
                {order.last_payment_sync_at ? <div>ბოლო სინქი: {formatDateOnly(order.last_payment_sync_at)}</div> : null}
                {order.paid_at ? <div>გადახდილია: {formatDateOnly(order.paid_at)}</div> : null}
                {order.cancelled_at ? <div>გაუქმდა: {formatDateOnly(order.cancelled_at)}</div> : null}
              </div>
              {order.failure_reason ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">TBC მიზეზი: {order.failure_reason}</div> : null}
              {order.notes ? <div className="mt-3 rounded-2xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">შენი შენიშვნა: {order.notes}</div> : null}
              {order.admin_note ? <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">ადმინის შენიშვნა: {order.admin_note}</div> : null}
              {refundMap.get(order.id) ? <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">დაბრუნების სტატუსი: {refundStatusLabel(refundMap.get(order.id)?.status)}</div> : null}
              {!refundMap.get(order.id) && isRefundRequestEligible(order) ? <form action={requestBoostRefundAction} className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><input type="hidden" name="orderId" value={order.id} /><label className="text-sm font-semibold text-neutral-900">თანხის დაბრუნების მიზეზი</label><textarea name="reason" required minLength={10} maxLength={1000} className="mt-2 min-h-24 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" placeholder="აღწერე პრობლემა ან დაბრუნების მიზეზი" /><div className="mt-3 flex flex-wrap items-center gap-3"><button className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold">თანხის დაბრუნების მოთხოვნა</button><Link href="/refund-policy" className="text-xs font-semibold text-brand underline">დაბრუნების პოლიტიკა</Link></div><p className="mt-2 text-xs text-neutral-500">მოთხოვნის გაგზავნა თანხას ავტომატურად არ აბრუნებს</p></form> : null}
            </div>
            <div className="flex flex-col gap-2 lg:items-end">
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">{boostStatusLabel(order.status, order.ends_at)}</span>
              {payment.tbcCheckoutEnabled && order.payment_method === "tbc_checkout" && order.provider_checkout_url && order.status === "pending_payment" ? (
                <a href={order.provider_checkout_url} target="_blank" rel="noreferrer" className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">TBC-ით გადახდის გაგრძელება</a>
              ) : null}
              {payment.tbcCheckoutEnabled && order.payment_provider === "tbc_checkout" ? (
                <form action={refreshBoostOrderStatusAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="nextPath" value={activeTab === "all" ? "/dashboard/billing" : `/dashboard/billing?status=${activeTab}`} />
                  <button className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">სტატუსის გადამოწმება</button>
                </form>
              ) : null}
              <Link href={`/dashboard/listings/${order.listing_id}/promote`} className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">მართვა</Link>
            </div>
          </div>
        )) : <div className="rounded-[2rem] border border-dashed border-neutral-300 bg-white px-6 py-10 text-sm text-neutral-500 shadow-sm">ამ ფილტრში VIP განთავსების შეკვეთა ვერ მოიძებნა.</div>}
      </div>
      <div className="mt-8 flex flex-wrap gap-4 text-sm"><Link href="/payment-terms" className="font-semibold text-brand underline">გადახდის პირობები</Link><Link href="/refund-policy" className="font-semibold text-brand underline">დაბრუნების პოლიტიკა</Link></div>
    </main>
  )
}
