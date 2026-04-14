import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import { notFound, redirect } from "next/navigation"
import { createBoostOrderAction, refreshBoostOrderStatusAction } from "@/app/dashboard/boosts/actions"
import {
  boostStatusLabel,
  buildSuggestedBoostReference,
  formatDateOnly,
  paymentMethodLabel,
  placementLabel,
  productPriceLabel,
  promotionStateFromListing,
} from "@/lib/boosts"
import { getBoostPaymentConfig } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"
import { listingStatusLabel } from "@/lib/listings"
import type { BoostOrder, BoostProduct } from "@/types/boost"

type PromoteBoostOrderRow = Omit<BoostOrder, "product_name" | "placement" | "duration_days"> & {
  listing_boost_products?: { name?: string | null; placement?: string | null; duration_days?: number | null } | null
}

function flashLabel(value?: string) {
  switch (value) {
    case "requested":
      return "VIP განთავსების მოთხოვნა შეიქმნა. ახლა გადადი გადახდების გვერდზე, შეასრულე გადახდა და დაელოდე დადასტურებას."
    case "already_requested":
      return "ამ განცხადებაზე იგივე პაკეტი უკვე გაქვს მოთხოვნილი ან აქტიურია."
    case "missing":
      return "შეავსე აუცილებელი ველები."
    case "not_found":
      return "განცხადება ან პაკეტი ვერ მოიძებნა."
    case "bad_product":
      return "პაკეტის კონფიგურაცია არასწორია."
    case "tbc_sync_active":
      return "სტატუსი განახლდა: TBC გადახდა დადასტურდა და boost უკვე აქტიურია."
    case "tbc_sync_pending":
      return "სტატუსი განახლდა, მაგრამ გადახდა ჯერ ისევ პროცესშია."
    case "tbc_sync_failed":
      return "სტატუსი განახლდა: TBC გადახდა ვერ დასრულდა ან გაუქმდა."
    case "tbc_sync_missing":
      return "TBC შეკვეთა ვერ მოიძებნა."
    case "tbc_sync_unavailable":
      return "ამ მოთხოვნაზე TBC სტატუსის გადამოწმება ხელმისაწვდომი არ არის."
    default:
      return value ? decodeURIComponent(value) : ""
  }
}

export default async function DashboardListingPromotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ flash?: string | string[] }>
}) {
  const { id } = await params
  const query = (await searchParams) ?? {}
  const flash = typeof query.flash === "string" ? flashLabel(query.flash) : ""
  const payment = getBoostPaymentConfig()
  const tbcEnabled = payment.tbcCheckoutEnabled

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=${encodeURIComponent(`/dashboard/listings/${id}/promote`)}`)

  const [{ data: listing }, { data: products }, { data: orders }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, seller_id, slug, title, status, cover_image_url, price, currency, is_vip, vip_until, promoted_until, featured_until, featured_slot")
      .eq("id", id)
      .eq("seller_id", user.id)
      .maybeSingle(),
    supabase
      .from("listing_boost_products")
      .select("id, name, placement, duration_days, price, currency, description, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("listing_boost_orders")
      .select(`
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
        listing_boost_products(name, placement, duration_days)
      `)
      .eq("listing_id", id)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false }),
  ])

  if (!listing) notFound()

  const state = promotionStateFromListing(listing)
  const typedProducts = (products ?? []) as BoostProduct[]
  const orderRows = (orders ?? []) as PromoteBoostOrderRow[]
  const typedOrders = orderRows.map((item) => ({
    ...item,
    product_name: item.listing_boost_products?.name ?? null,
    placement: item.listing_boost_products?.placement ?? null,
    duration_days: item.listing_boost_products?.duration_days ?? null,
  })) as BoostOrder[]

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">VIP განთავსება</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">განცხადების VIP განთავსება</h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              აქედან ირჩევ პაკეტს, ამზადებ შეკვეთას და წყვეტ გადახდის მეთოდს. წარმატებული TBC Checkout გადახდა ავტომატურად ააქტიურებს VIP განთავსებას, ხოლო ხელით მეთოდები დასტურდება დამატებითი შემოწმების შემდეგ.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/billing" className="ui-btn-secondary">შეკვეთები და გადახდები</Link>
            <Link href="/dashboard/listings" className="ui-btn-secondary">უკან განცხადებებზე</Link>
          </div>
        </div>
      </section>

      {flash ? <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{flash}</div> : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="ui-card p-6">
          <div className="ui-eyebrow">განცხადება</div>
          <div className="mt-4 flex gap-4">
            <div className="h-28 w-24 overflow-hidden rounded-[1.2rem] bg-surface-alt">
              <SmartImage src={listing.cover_image_url} alt={listing.title} wrapperClassName="h-full w-full" fallbackLabel="სურათი არ არის" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-black text-text">{listing.title}</h2>
              <div className="mt-2 text-sm text-text-soft">სტატუსი: {listingStatusLabel(listing.status)}</div>
              <div className="mt-2 text-sm font-semibold text-text">{listing.price} {listing.currency === "GEL" ? "₾" : listing.currency}</div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className={state.isVip ? "ui-pill-vip-soft" : "ui-pill !bg-surface-alt !px-3 !py-1 text-text-soft"}>VIP {state.vipUntil ? `· ${formatDateOnly(state.vipUntil.toISOString())}` : ""}</span>
                <span className={state.isPromoted ? "ui-pill-promoted" : "ui-pill !bg-surface-alt !px-3 !py-1 text-text-soft"}>დამატებითი ხილვადობა {state.promotedUntil ? `· ${formatDateOnly(state.promotedUntil.toISOString())}` : ""}</span>
                <span className={state.isFeatured ? "ui-pill-featured" : "ui-pill !bg-surface-alt !px-3 !py-1 text-text-soft"}>მთავარ ბლოკში გამოჩენა{state.featuredSlot ? ` #${state.featuredSlot}` : ""} {state.featuredUntil ? `· ${formatDateOnly(state.featuredUntil.toISOString())}` : ""}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ui-card p-6">
          <div className="ui-eyebrow">გადახდის გზა</div>
          <h2 className="mt-3 text-2xl font-black text-text">გადახდის ინსტრუქცია</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-text-soft">
            <p>1. აირჩიე სასურველი პაკეტი და შექმენი შეკვეთა.</p>
            <p>2. თუ აირჩევ TBC Checkout-ს, პირდაპირ ბანკის დაცულ გვერდზე გადახვალ.</p>
            <p>3. ხელით გადახდისას გამოიყენე წინასწარ შევსებული რეფერენსი გადარიცხვის დანიშნულებაში.</p>
            <p>4. ხელით დამუშავებადი შეკვეთები ჩვეულებრივ სრულდება დაახლოებით {payment.approvalTime}-ში.</p>
          </div>

          <div className="mt-5 space-y-4 rounded-[1.25rem] border border-dashed border-line bg-surface-alt px-4 py-4 text-sm text-text-soft">
            {payment.hasBankDetails ? (
              <div className="space-y-2">
                <div className="font-semibold text-text">საბანკო გადარიცხვა</div>
                {payment.bankName ? <div>ბანკი: <span className="font-medium text-text">{payment.bankName}</span></div> : null}
                {payment.accountHolder ? <div>მიმღები: <span className="font-medium text-text">{payment.accountHolder}</span></div> : null}
                {payment.accountNumber ? <div>ანგარიში / IBAN: <span className="font-mono text-xs text-text sm:text-sm">{payment.accountNumber}</span></div> : null}
              </div>
            ) : null}

            {tbcEnabled ? (
              <div className="space-y-2">
                <div className="font-semibold text-text">TBC Checkout</div>
                <div>ეს მეთოდი გახსნის ბანკის გადახდის გვერდს და დასრულების შემდეგ ისევ შეკვეთების გვერდზე დაგაბრუნებს.</div>
              </div>
            ) : null}

            {payment.hasExternalPaymentUrl ? (
              <div className="space-y-2">
                <div className="font-semibold text-text">გარე ბარათის გადახდა</div>
                <a href={payment.externalPaymentUrl} target="_blank" rel="noreferrer" className="ui-btn-secondary">გადახდის ბმულის გახსნა</a>
              </div>
            ) : null}

            <div>{payment.note}</div>
            <div>{payment.proofHint}</div>
            <div>
              კითხვებისთვის: <a href={`mailto:${payment.paymentContactEmail}`} className="font-semibold text-brand underline underline-offset-4">{payment.paymentContactEmail}</a>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 ui-card p-6">
        <div className="ui-eyebrow">პაკეტები</div>
        <h2 className="mt-3 text-2xl font-black text-text">აირჩიე VIP პაკეტი</h2>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {typedProducts.map((product) => {
            const suggestedReference = buildSuggestedBoostReference(listing.id, product.id)
            return (
              <form key={product.id} action={createBoostOrderAction} className="rounded-[1.35rem] border border-line bg-surface-alt p-5">
                <input type="hidden" name="listingId" value={listing.id} suppressHydrationWarning />
                <input type="hidden" name="productId" value={product.id} suppressHydrationWarning />
                <input type="hidden" name="nextPath" value={`/dashboard/listings/${listing.id}/promote`} suppressHydrationWarning />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="ui-eyebrow">{placementLabel(product.placement)}</div>
                    <div className="mt-2 text-xl font-black text-text">{product.name}</div>
                    <div className="mt-2 text-sm leading-7 text-text-soft">{product.description || "—"}</div>
                  </div>
                  <div className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">{productPriceLabel(product)}</div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text">გადახდის მეთოდი</label>
                    <select name="paymentMethod" defaultValue={tbcEnabled ? "tbc_checkout" : "bank_transfer"} className="ui-input" suppressHydrationWarning>
                      {tbcEnabled ? <option value="tbc_checkout">TBC Checkout</option> : null}
                      <option value="bank_transfer">საბანკო გადარიცხვა</option>
                      <option value="manual_cash">ქეში / ოფლაინ</option>
                      {payment.hasExternalPaymentUrl ? <option value="card_external">გარე ბარათის ლინკი</option> : null}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text">გადახდის რეფერენსი</label>
                    <input name="paymentReference" defaultValue={suggestedReference} className="ui-input" placeholder="მაგ: SS-AB12CD-VIP7D" suppressHydrationWarning />
                    <div className="mt-2 text-xs leading-5 text-text-soft">ეს რეფერენსი გამოიყენე გადარიცხვის დანიშნულებაში ან მოგვწერე, თუ გადამოწმება დაგვჭირდება.</div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-semibold text-text">შენიშვნა</label>
                  <textarea name="notes" className="min-h-24 w-full rounded-[1rem] border border-line bg-white px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-soft focus:border-brand focus:ring-4 focus:ring-brand-soft/70" placeholder="სურვილის შემთხვევაში მიუთითე დამატებითი დეტალი: გადახდის დრო, გამოყენებული არხი ან საკონტაქტო ინფორმაცია" suppressHydrationWarning />
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs leading-5 text-text-soft">გაგზავნის შემდეგ შეკვეთა გამოჩნდება შენს გადახდების გვერდზე და დამუშავებისთვის შიდა პანელშიც.</div>
                  <button className="ui-btn-primary" suppressHydrationWarning>შეკვეთის შექმნა</button>
                </div>
              </form>
            )
          })}
        </div>
      </section>

      <section className="mt-8 ui-card p-6">
        <div className="ui-eyebrow">ისტორია</div>
        <h2 className="mt-3 text-2xl font-black text-text">ბოლო მოთხოვნები</h2>

        <div className="mt-6 space-y-4">
          {typedOrders.length > 0 ? typedOrders.map((order) => (
            <div key={order.id} className="rounded-[1.25rem] border border-line bg-surface-alt p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-text">{order.product_name || order.product_id}</div>
                  <div className="mt-1 text-sm text-text-soft">{placementLabel(order.placement)} · {order.amount} {order.currency === "GEL" ? "₾" : order.currency}</div>
                </div>
                <span className="ui-pill !px-3 !py-1 text-xs">{boostStatusLabel(order.status, order.ends_at)}</span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1rem] bg-white px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">მეთოდი:</span> {paymentMethodLabel(order.payment_method)}</div>
                <div className="rounded-[1rem] bg-white px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">რეფერენსი:</span> {order.payment_reference || "—"}</div>
                <div className="rounded-[1rem] bg-white px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">შეიქმნა:</span> {formatDateOnly(order.created_at)}</div>
                <div className="rounded-[1rem] bg-white px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">ვადა:</span> {order.ends_at ? formatDateOnly(order.ends_at) : "—"}</div>
                {order.provider_status ? <div className="rounded-[1rem] bg-white px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">TBC სტატუსი:</span> {order.provider_status}</div> : null}
                {order.last_payment_sync_at ? <div className="rounded-[1rem] bg-white px-4 py-3 text-sm text-text-soft"><span className="font-semibold text-text">ბოლო სინქი:</span> {formatDateOnly(order.last_payment_sync_at)}</div> : null}
              </div>
              {order.failure_reason ? <div className="mt-3 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">TBC მიზეზი: {order.failure_reason}</div> : null}
              {order.notes ? <div className="mt-3 rounded-[1rem] bg-white px-4 py-3 text-sm text-text-soft">შენი შენიშვნა: {order.notes}</div> : null}
              {order.admin_note ? <div className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ადმინის შენიშვნა: {order.admin_note}</div> : null}
              {order.payment_provider === "tbc_checkout" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {order.provider_checkout_url && order.status === "pending_payment" ? (
                    <a href={order.provider_checkout_url} target="_blank" rel="noreferrer" className="ui-btn-primary">TBC-ით გადახდის გაგრძელება</a>
                  ) : null}
                  <form action={refreshBoostOrderStatusAction}>
                    <input type="hidden" name="orderId" value={order.id} suppressHydrationWarning />
                    <input type="hidden" name="nextPath" value={`/dashboard/listings/${listing.id}/promote`} suppressHydrationWarning />
                    <button className="ui-btn-secondary" suppressHydrationWarning>სტატუსის გადამოწმება</button>
                  </form>
                </div>
              ) : null}
            </div>
          )) : <div className="rounded-[1.25rem] border border-dashed border-line px-5 py-8 text-sm text-text-soft">ჯერ არცერთი VIP განთავსების შეკვეთა არ გაქვს შექმნილი.</div>}
        </div>
      </section>
    </main>
  )
}
