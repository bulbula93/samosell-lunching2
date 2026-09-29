import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import StatCard from "@/components/shared/StatCard"
import { adminUserAction } from "@/app/admin/actions"
import { requireAdminUser } from "@/lib/auth"

const PAGE_SIZE = 250

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value))
}

function formatDateTime(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function displayValue(value?: string | null) {
  const safe = String(value ?? "").trim()
  return safe || "—"
}

export default async function AdminStoresPage({
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
  const rawQ = typeof params.q === "string" ? params.q : ""
  const q = rawQ.trim().toLocaleLowerCase("ka-GE").slice(0, 80)
  const requestedStatus = typeof params.status === "string" ? params.status : "all"
  const status =
    requestedStatus === "verified" ||
    requestedStatus === "unverified" ||
    requestedStatus === "suspended"
      ? requestedStatus
      : "all"
  const ok = typeof params.ok === "string" ? params.ok : ""
  const error = typeof params.error === "string" ? params.error : ""

  const { supabase, user } = await requireAdminUser("/dashboard")

  const [
    storesResponse,
    listingsResponse,
    totalCount,
    verifiedCount,
    suspendedCount,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, full_name, bio, city, is_seller_verified, is_suspended, is_admin, created_at, updated_at, store_logo_url, store_banner_url, store_phone, store_whatsapp, store_telegram, store_instagram, store_facebook, store_website, store_hours, store_address, store_map_url, tiktok_username, tiktok_live_until",
      )
      .eq("seller_type", "store")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
    supabase.from("listings").select("seller_id, status").limit(10000),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("seller_type", "store"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("seller_type", "store")
      .eq("is_seller_verified", true),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("seller_type", "store")
      .eq("is_suspended", true),
  ])

  const listingStats = new Map<string, { total: number; active: number; archived: number }>()
  for (const listing of listingsResponse.data ?? []) {
    const current = listingStats.get(listing.seller_id) ?? {
      total: 0,
      active: 0,
      archived: 0,
    }
    current.total += 1
    if (listing.status === "active") current.active += 1
    if (listing.status === "archived") current.archived += 1
    listingStats.set(listing.seller_id, current)
  }

  const stores = (storesResponse.data ?? []).filter((store) => {
    if (status === "verified" && !store.is_seller_verified) return false
    if (status === "unverified" && store.is_seller_verified) return false
    if (status === "suspended" && !store.is_suspended) return false

    if (!q) return true
    const haystack = [
      store.full_name,
      store.username,
      store.city,
      store.store_phone,
      store.store_address,
      store.store_instagram,
      store.store_website,
      store.tiktok_username,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ka-GE")

    return haystack.includes(q)
  })

  const queryError = storesResponse.error || listingsResponse.error

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
              მაღაზიის პროფილი, საკონტაქტო მონაცემები, განცხადებების სტატუსი,
              verification და suspension ერთ ოპერაციულ ხედში.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin/users" className="ui-btn-secondary">
              ყველა მომხმარებელი
            </Link>
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
        <StatCard label="სულ მაღაზიები" value={totalCount.count ?? 0} />
        <StatCard label="ვერიფიცირებული" value={verifiedCount.count ?? 0} />
        <StatCard
          label="არავერიფიცირებული"
          value={Math.max(0, (totalCount.count ?? 0) - (verifiedCount.count ?? 0))}
        />
        <StatCard label="შეზღუდული" value={suspendedCount.count ?? 0} />
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            name="q"
            defaultValue={rawQ}
            className="ui-input"
            placeholder="სახელი, username, ქალაქი, ტელეფონი..."
          />
          <select name="status" defaultValue={status} className="ui-input">
            <option value="all">ყველა მაღაზია</option>
            <option value="verified">ვერიფიცირებული</option>
            <option value="unverified">არავერიფიცირებული</option>
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

      <section className="mt-6 space-y-5">
        {stores.length ? (
          stores.map((store) => {
            const stats = listingStats.get(store.id) ?? {
              total: 0,
              active: 0,
              archived: 0,
            }
            const displayName =
              store.full_name || store.username || "სახელი მითითებული არ არის"
            const isSelf = store.id === user.id

            return (
              <article key={store.id} className="ui-card overflow-hidden">
                {store.store_banner_url ? (
                  <div className="h-28 border-b border-line sm:h-36">
                    <SmartImage
                      src={store.store_banner_url}
                      alt={displayName}
                      wrapperClassName="h-full w-full"
                      className="object-cover"
                      fallbackLabel=""
                    />
                  </div>
                ) : null}

                <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div>
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[1.2rem] border border-line bg-surface-alt">
                        <SmartImage
                          src={store.store_logo_url}
                          alt={displayName}
                          wrapperClassName="h-full w-full"
                          className="object-cover"
                          fallbackLabel="ლოგო"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="ui-pill !px-3 !py-1 text-xs">მაღაზია</span>
                          {store.is_seller_verified ? (
                            <span className="ui-pill-soft !px-3 !py-1 text-xs">
                              ვერიფიცირებული
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                              არავერიფიცირებული
                            </span>
                          )}
                          {store.is_suspended ? (
                            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                              შეზღუდული
                            </span>
                          ) : null}
                          {store.is_admin ? (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                              Admin
                            </span>
                          ) : null}
                          {isSelf ? (
                            <span className="rounded-full border border-line bg-surface-alt px-3 py-1 text-xs font-semibold text-text-soft">
                              შენი ანგარიში
                            </span>
                          ) : null}
                        </div>

                        <h2 className="mt-3 truncate text-2xl font-black text-text">
                          {displayName}
                        </h2>
                        <div className="mt-1 text-sm text-text-soft">
                          @{store.username || "username არ არის"} · {displayValue(store.city)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">სულ განცხადება:</span> {stats.total}
                      </div>
                      <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">აქტიური:</span> {stats.active}
                      </div>
                      <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">არქივი:</span> {stats.archived}
                      </div>
                      <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">რეგისტრაცია:</span> {formatDate(store.created_at)}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1rem] border border-line px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">ტელეფონი:</span>{" "}
                        {displayValue(store.store_phone)}
                      </div>
                      <div className="rounded-[1rem] border border-line px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">მისამართი:</span>{" "}
                        {displayValue(store.store_address)}
                      </div>
                      <div className="rounded-[1rem] border border-line px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">სამუშაო საათები:</span>{" "}
                        {displayValue(store.store_hours)}
                      </div>
                      <div className="rounded-[1rem] border border-line px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">Website:</span>{" "}
                        {displayValue(store.store_website)}
                      </div>
                      <div className="rounded-[1rem] border border-line px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">Instagram:</span>{" "}
                        {displayValue(store.store_instagram)}
                      </div>
                      <div className="rounded-[1rem] border border-line px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">WhatsApp:</span>{" "}
                        {displayValue(store.store_whatsapp)}
                      </div>
                      <div className="rounded-[1rem] border border-line px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">Telegram:</span>{" "}
                        {displayValue(store.store_telegram)}
                      </div>
                      <div className="rounded-[1rem] border border-line px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">TikTok:</span>{" "}
                        {displayValue(store.tiktok_username)}
                        {store.tiktok_live_until
                          ? " · LIVE-მდე " + formatDateTime(store.tiktok_live_until)
                          : ""}
                      </div>
                    </div>

                    {store.bio ? (
                      <div className="mt-4 rounded-[1rem] border border-line bg-surface-alt px-4 py-3 text-sm leading-6 text-text-soft">
                        {store.bio}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {store.username ? (
                      <Link
                        href={`/seller/${encodeURIComponent(store.username)}`}
                        className="ui-btn-primary w-full text-center"
                      >
                        საჯარო მაღაზიის გახსნა
                      </Link>
                    ) : (
                      <div className="rounded-full border border-line bg-surface-alt px-5 py-3 text-center text-sm font-semibold text-text-soft">
                        საჯარო პროფილი მიუწვდომელია — username არ აქვს
                      </div>
                    )}

                    <form action={adminUserAction} className="rounded-[1.2rem] border border-line bg-surface-alt p-4">
                      <input type="hidden" name="userId" value={store.id} />
                      <input type="hidden" name="nextPath" value="/admin/stores" />

                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-text">
                          Admin შენიშვნა
                        </span>
                        <textarea
                          name="adminNote"
                          maxLength={2000}
                          className="min-h-24 w-full rounded-[1rem] border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                          placeholder="მოქმედების მიზეზი (არასავალდებულო)"
                        />
                      </label>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {store.is_suspended ? (
                          <button name="decision" value="restore" className="ui-btn-secondary">
                            შეზღუდვის მოხსნა
                          </button>
                        ) : (
                          <button
                            name="decision"
                            value="suspend"
                            disabled={store.is_admin || isSelf}
                            className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            მაღაზიის შეზღუდვა
                          </button>
                        )}

                        {store.is_seller_verified ? (
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

                      {store.is_suspended ? (
                        <p className="mt-2 text-xs leading-5 text-text-soft">
                          შეზღუდვის მოხსნა მაღაზიას აღადგენს, მაგრამ დაარქივებული განცხადებები ავტომატურად არ გამოქვეყნდება.
                        </p>
                      ) : null}
                    </form>

                    <div className="rounded-[1rem] border border-line px-4 py-3 text-xs leading-5 text-text-soft">
                      <div>User ID: {store.id}</div>
                      <div className="mt-1">ბოლო განახლება: {formatDateTime(store.updated_at)}</div>
                    </div>
                  </div>
                </div>
              </article>
            )
          })
        ) : (
          <div className="ui-card border-dashed px-6 py-10 text-sm text-text-soft">
            ამ ფილტრით მაღაზია ვერ მოიძებნა.
          </div>
        )}
      </section>
    </main>
  )
}
