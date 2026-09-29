import Link from "next/link"
import { adminListingAction } from "@/app/admin/actions"
import { requireAdminUser } from "@/lib/auth"
import StatCard from "@/components/shared/StatCard"

const PAGE_SIZE = 100

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value))
}

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "აქტიური"
    case "draft":
      return "დრაფტი"
    case "pending_review":
      return "შემოწმებაში"
    case "reserved":
      return "დაჯავშნილი"
    case "archived":
      return "არქივი"
    case "rejected":
      return "უარყოფილი"
    case "sold":
      return "გაყიდული"
    default:
      return status
  }
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string | string[]
    status?: string | string[]
    ok?: string | string[]
    error?: string | string[]
  }>
}) {
  const params = (await searchParams) ?? {}
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : ""
  const status = typeof params.status === "string" ? params.status : "all"
  const ok = typeof params.ok === "string" ? params.ok : ""
  const error = typeof params.error === "string" ? params.error : ""
  const { supabase } = await requireAdminUser("/dashboard")

  let listingsQuery = supabase
    .from("listings")
    .select(
      "id, seller_id, public_id, title, slug, price, currency, status, city, is_vip, views_count, favorites_count, created_at, published_at, featured_until, home_banner_until",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE)

  if (status !== "all") {
    listingsQuery = listingsQuery.eq("status", status)
  }

  if (q) {
    listingsQuery = listingsQuery.ilike("title", `%${q}%`)
  }

  const [
    listingsResponse,
    allCount,
    activeCount,
    draftCount,
    vipCount,
  ] = await Promise.all([
    listingsQuery,
    supabase.from("listings").select("id", { count: "exact", head: true }),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("is_vip", true),
  ])

  const listings = listingsResponse.data ?? []
  const sellerIds = [...new Set(listings.map((item) => item.seller_id).filter(Boolean))]
  const sellerResponse = sellerIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, full_name, seller_type, is_suspended")
        .in("id", sellerIds)
    : { data: [], error: null }

  const sellers = new Map(
    (sellerResponse.data ?? []).map((profile) => [profile.id, profile]),
  )

  const queryError = listingsResponse.error || sellerResponse.error

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Admin / Listings</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              განცხადებების მართვა
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              ყველა განცხადების ერთიანი ხედვა და კონტროლი. დამალვა/აღდგენა სრულდება ატომურად და ავტომატურად იწერება Admin Audit Log-ში.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/audit" className="ui-btn-secondary">
              Audit Log
            </Link>
            <Link href="/admin" className="ui-btn-secondary">
              ადმინისტრირების მთავარი
            </Link>
          </div>
        </div>
      </section>

      {ok ? (
        <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {ok}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="სულ განცხადებები" value={allCount.count ?? 0} />
        <StatCard label="აქტიური" value={activeCount.count ?? 0} />
        <StatCard label="დრაფტი" value={draftCount.count ?? 0} />
        <StatCard label="VIP მონიშნული" value={vipCount.count ?? 0} />
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            name="q"
            defaultValue={q}
            className="ui-input"
            placeholder="ძებნა სათაურით"
          />
          <select name="status" defaultValue={status} className="ui-input">
            <option value="all">ყველა სტატუსი</option>
            <option value="active">აქტიური</option>
            <option value="draft">დრაფტი</option>
            <option value="pending_review">შემოწმებაში</option>
            <option value="reserved">დაჯავშნილი</option>
            <option value="archived">არქივი</option>
            <option value="rejected">უარყოფილი</option>
            <option value="sold">გაყიდული</option>
          </select>
          <button className="ui-btn-primary">გაფილტვრა</button>
        </form>
      </section>

      {queryError ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          მონაცემების ჩატვირთვა ვერ მოხერხდა: {queryError.message}
        </div>
      ) : null}

      <section className="mt-6 space-y-4">
        {listings.length ? (
          listings.map((listing) => {
            const seller = sellers.get(listing.seller_id)
            const sellerName =
              seller?.full_name || seller?.username || "უცნობი გამყიდველი"
            const currency = listing.currency === "GEL" ? "₾" : listing.currency
            const canHide = listing.status === "active" || listing.status === "reserved"
            const canRestore = listing.status === "archived"

            return (
              <article key={listing.id} className="ui-card p-5 sm:p-6">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="ui-pill !px-3 !py-1 text-xs">
                        {statusLabel(listing.status)}
                      </span>
                      {listing.is_vip ? (
                        <span className="ui-pill-soft !px-3 !py-1 text-xs">VIP</span>
                      ) : null}
                      {seller?.is_suspended ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                          შეზღუდული გამყიდველი
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-3 text-xl font-black text-text">
                      {listing.title}
                    </h2>
                    <div className="mt-2 text-sm text-text-soft">
                      {listing.price} {currency} · {listing.city || "ქალაქი მითითებული არ არის"}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">გამყიდველი:</span> {sellerName}
                      </div>
                      <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">ნახვები:</span> {listing.views_count ?? 0}
                      </div>
                      <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">რჩეულები:</span> {listing.favorites_count ?? 0}
                      </div>
                      <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">შეიქმნა:</span> {formatDate(listing.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      <Link
                        href={`/listing/${listing.slug}`}
                        className="ui-btn-primary text-center"
                      >
                        განცხადების გახსნა
                      </Link>
                      <Link
                        href="/admin/reports?kind=listing&status=all"
                        className="ui-btn-secondary text-center"
                      >
                        რეპორტები
                      </Link>
                    </div>

                    {(canHide || canRestore) ? (
                      <form action={adminListingAction} className="rounded-[1.2rem] border border-line bg-surface-alt p-4">
                        <input type="hidden" name="listingId" value={listing.id} />
                        <label className="mb-2 block text-sm font-semibold text-text">
                          Admin შენიშვნა
                        </label>
                        <textarea
                          name="adminNote"
                          maxLength={2000}
                          className="min-h-20 w-full rounded-[1rem] border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                          placeholder="რატომ იცვლება სტატუსი? (არასავალდებულო)"
                        />
                        {canHide ? (
                          <button
                            name="decision"
                            value="hide"
                            className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                          >
                            განცხადების დამალვა
                          </button>
                        ) : (
                          <button
                            name="decision"
                            value="restore"
                            disabled={seller?.is_suspended}
                            className="ui-btn-secondary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            განცხადების აღდგენა
                          </button>
                        )}
                        {canRestore ? (
                          <p className="mt-2 text-xs leading-5 text-text-soft">
                            აღდგენა მუშაობს მხოლოდ იმ განცხადებაზე, რომელიც ამ Admin Panel-იდან იყო დამალული. შეზღუდული seller-ის განცხადება არ აღდგება.
                          </p>
                        ) : null}
                      </form>
                    ) : null}

                    <div className="rounded-[1rem] border border-line px-4 py-3 text-xs leading-5 text-text-soft">
                      ID: {listing.public_id || listing.id}
                    </div>
                  </div>
                </div>
              </article>
            )
          })
        ) : (
          <div className="ui-card border-dashed px-6 py-10 text-sm text-text-soft">
            ამ ფილტრით განცხადება ვერ მოიძებნა.
          </div>
        )}
      </section>
    </main>
  )
}
