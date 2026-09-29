import Link from "next/link"
import { adminUserAction } from "@/app/admin/actions"
import { requireAdminUser } from "@/lib/auth"
import StatCard from "@/components/shared/StatCard"

const PAGE_SIZE = 250

type StoreFilter = "all" | "verified" | "incomplete" | "suspended"

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value))
}

function storeCompleteness(profile: {
  username: string | null
  full_name: string | null
  store_logo_url: string | null
  store_phone: string | null
  store_address: string | null
  store_hours: string | null
}) {
  const fields = [
    profile.username,
    profile.full_name,
    profile.store_logo_url,
    profile.store_phone,
    profile.store_address,
    profile.store_hours,
  ]
  const filled = fields.filter((value) => Boolean(String(value ?? "").trim())).length
  return Math.round((filled / fields.length) * 100)
}

export default async function AdminStoresPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string | string[]
    filter?: string | string[]
    ok?: string | string[]
    error?: string | string[]
  }>
}) {
  const params = (await searchParams) ?? {}
  const rawQuery = typeof params.q === "string" ? params.q : ""
  const q = rawQuery.trim().toLocaleLowerCase("ka-GE").slice(0, 80)
  const requestedFilter = typeof params.filter === "string" ? params.filter : "all"
  const filter: StoreFilter =
    requestedFilter === "verified" ||
    requestedFilter === "incomplete" ||
    requestedFilter === "suspended"
      ? requestedFilter
      : "all"
  const ok = typeof params.ok === "string" ? params.ok : ""
  const error = typeof params.error === "string" ? params.error : ""

  const { supabase, user } = await requireAdminUser("/dashboard")

  const [profilesResponse, listingsResponse] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, full_name, city, is_seller_verified, is_suspended, is_admin, created_at, updated_at, store_logo_url, store_banner_url, store_phone, store_whatsapp, store_telegram, store_instagram, store_facebook, store_website, store_hours, store_address, store_map_url",
      )
      .eq("seller_type", "store")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
    supabase
      .from("listings")
      .select("seller_id, status, views_count, favorites_count")
      .limit(10000),
  ])

  const storesRaw = profilesResponse.data ?? []
  const listingStats = new Map<
    string,
    { all: number; active: number; views: number; favorites: number }
  >()

  for (const listing of listingsResponse.data ?? []) {
    const current = listingStats.get(listing.seller_id) ?? {
      all: 0,
      active: 0,
      views: 0,
      favorites: 0,
    }
    current.all += 1
    if (listing.status === "active") current.active += 1
    current.views += listing.views_count ?? 0
    current.favorites += listing.favorites_count ?? 0
    listingStats.set(listing.seller_id, current)
  }

  const stores = storesRaw.filter((profile) => {
    const completeness = storeCompleteness(profile)
    if (filter === "verified" && !profile.is_seller_verified) return false
    if (filter === "suspended" && !profile.is_suspended) return false
    if (filter === "incomplete" && completeness >= 100) return false

    if (!q) return true
    const haystack = [
      profile.username,
      profile.full_name,
      profile.city,
      profile.store_phone,
      profile.store_address,
      profile.store_website,
      profile.store_instagram,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ka-GE")

    return haystack.includes(q)
  })

  const verifiedCount = storesRaw.filter((profile) => profile.is_seller_verified).length
  const suspendedCount = storesRaw.filter((profile) => profile.is_suspended).length
  const completeCount = storesRaw.filter((profile) => storeCompleteness(profile) === 100).length
  const queryError = profilesResponse.error || listingsResponse.error

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Admin / Stores</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              მაღაზიების მართვა
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              მაღაზიების პროფილები, შევსების ხარისხი, განცხადებების აქტივობა, verification და suspension ერთ სივრცეში.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/audit" className="ui-btn-secondary">Audit Log</Link>
            <Link href="/admin" className="ui-btn-secondary">ადმინისტრირების მთავარი</Link>
          </div>
        </div>
      </section>

      {ok ? (
        <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div>
      ) : null}
      {error ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="სულ მაღაზიები" value={storesRaw.length} />
        <StatCard label="ვერიფიცირებული" value={verifiedCount} />
        <StatCard label="სრულად შევსებული" value={completeCount} />
        <StatCard label="შეზღუდული" value={suspendedCount} />
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            name="q"
            defaultValue={rawQuery}
            className="ui-input"
            placeholder="მაღაზია, username, ქალაქი, ტელეფონი…"
          />
          <select name="filter" defaultValue={filter} className="ui-input">
            <option value="all">ყველა მაღაზია</option>
            <option value="verified">ვერიფიცირებული</option>
            <option value="incomplete">არასრულად შევსებული</option>
            <option value="suspended">შეზღუდული</option>
          </select>
          <button className="ui-btn-primary">გაფილტვრა</button>
        </form>
      </section>

      {queryError ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          მაღაზიების ჩატვირთვა ვერ მოხერხდა: {queryError.message}
        </div>
      ) : null}

      <section className="mt-6 space-y-4">
        {stores.length ? stores.map((profile) => {
          const stats = listingStats.get(profile.id) ?? { all: 0, active: 0, views: 0, favorites: 0 }
          const completeness = storeCompleteness(profile)
          const displayName = profile.full_name || profile.username || "უსახელო მაღაზია"
          const isSelf = profile.id === user.id

          return (
            <article key={profile.id} className="ui-card p-5 sm:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="ui-pill !px-3 !py-1 text-xs">მაღაზია</span>
                    {profile.is_seller_verified ? <span className="ui-pill-soft !px-3 !py-1 text-xs">ვერიფიცირებული</span> : null}
                    {profile.is_suspended ? (
                      <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">შეზღუდული</span>
                    ) : null}
                    <span className={completeness === 100
                      ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                      : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"}>
                      პროფილი {completeness}%
                    </span>
                  </div>

                  <h2 className="mt-3 text-xl font-black text-text">{displayName}</h2>
                  <div className="mt-2 text-sm text-text-soft">
                    @{profile.username || "username არ არის"} · {profile.city || "ქალაქი მითითებული არ არის"}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">განცხადებები:</span> {stats.all}
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">აქტიური:</span> {stats.active}
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">ნახვები:</span> {stats.views}
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">რჩეულები:</span> {stats.favorites}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[1rem] border border-line px-4 py-3 text-sm text-text-soft">
                      <div><span className="font-semibold text-text">ტელეფონი:</span> {profile.store_phone || "—"}</div>
                      <div className="mt-2"><span className="font-semibold text-text">მისამართი:</span> {profile.store_address || "—"}</div>
                      <div className="mt-2"><span className="font-semibold text-text">საათები:</span> {profile.store_hours || "—"}</div>
                    </div>
                    <div className="rounded-[1rem] border border-line px-4 py-3 text-sm text-text-soft">
                      <div><span className="font-semibold text-text">Website:</span> {profile.store_website || "—"}</div>
                      <div className="mt-2"><span className="font-semibold text-text">Instagram:</span> {profile.store_instagram || "—"}</div>
                      <div className="mt-2"><span className="font-semibold text-text">განახლდა:</span> {formatDate(profile.updated_at)}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {profile.username ? (
                    <Link href={`/seller/${encodeURIComponent(profile.username)}`} className="ui-btn-primary block text-center">
                      მაღაზიის საჯარო გვერდი
                    </Link>
                  ) : (
                    <div className="rounded-full border border-line bg-surface-alt px-5 py-3 text-center text-sm font-semibold text-text-soft">
                      საჯარო გვერდი მიუწვდომელია — username არ აქვს
                    </div>
                  )}

                  <form action={adminUserAction} className="rounded-[1.2rem] border border-line bg-surface-alt p-4">
                    <input type="hidden" name="userId" value={profile.id} />
                    <input type="hidden" name="returnPath" value="/admin/stores" />
                    <label className="mb-2 block text-sm font-semibold text-text">Admin შენიშვნა</label>
                    <textarea
                      name="adminNote"
                      maxLength={2000}
                      className="min-h-20 w-full rounded-[1rem] border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                      placeholder="მოქმედების მიზეზი (არასავალდებულო)"
                    />
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {profile.is_suspended ? (
                        <button name="decision" value="restore" className="ui-btn-secondary">შეზღუდვის მოხსნა</button>
                      ) : (
                        <button
                          name="decision"
                          value="suspend"
                          disabled={profile.is_admin || isSelf}
                          className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          მაღაზიის შეზღუდვა
                        </button>
                      )}

                      {profile.is_seller_verified ? (
                        <button
                          name="decision"
                          value="unverify"
                          disabled={isSelf}
                          className="ui-btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ვერიფიკაციის მოხსნა
                        </button>
                      ) : (
                        <button
                          name="decision"
                          value="verify"
                          disabled={isSelf}
                          className="ui-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          მაღაზიის ვერიფიკაცია
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="rounded-[1rem] border border-line px-4 py-3 text-xs leading-5 text-text-soft">
                    Store ID: {profile.id}<br />
                    რეგისტრაცია: {formatDate(profile.created_at)}
                  </div>
                </div>
              </div>
            </article>
          )
        }) : (
          <div className="ui-card border-dashed px-6 py-10 text-sm leading-7 text-text-soft">
            {storesRaw.length === 0
              ? "ჯერ არცერთი seller არ არის რეგისტრირებული როგორც მაღაზია. პირველი store პროფილის შექმნისთანავე ის აქ გამოჩნდება."
              : "ამ ფილტრით მაღაზია ვერ მოიძებნა."}
          </div>
        )}
      </section>
    </main>
  )
}
