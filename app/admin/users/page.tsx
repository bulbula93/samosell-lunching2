import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import StatCard from "@/components/shared/StatCard"

const PAGE_SIZE = 250

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value))
}

type UserFilter = "all" | "suspended" | "stores" | "admins"

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[]; filter?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const q = typeof params.q === "string" ? params.q.trim().toLocaleLowerCase("ka-GE").slice(0, 80) : ""
  const requestedFilter = typeof params.filter === "string" ? params.filter : "all"
  const filter: UserFilter =
    requestedFilter === "suspended" ||
    requestedFilter === "stores" ||
    requestedFilter === "admins"
      ? requestedFilter
      : "all"

  const { supabase } = await requireAdminUser("/dashboard")

  const [
    profilesResponse,
    listingsResponse,
    allCount,
    suspendedCount,
    storeCount,
    adminCount,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, full_name, city, seller_type, is_seller_verified, is_suspended, is_admin, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
    supabase.from("listings").select("seller_id, status").limit(5000),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_suspended", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("seller_type", "store"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", true),
  ])

  const listingStats = new Map<string, { all: number; active: number }>()
  for (const listing of listingsResponse.data ?? []) {
    const current = listingStats.get(listing.seller_id) ?? { all: 0, active: 0 }
    current.all += 1
    if (listing.status === "active") current.active += 1
    listingStats.set(listing.seller_id, current)
  }

  const profiles = (profilesResponse.data ?? []).filter((profile) => {
    if (filter === "suspended" && !profile.is_suspended) return false
    if (filter === "stores" && profile.seller_type !== "store") return false
    if (filter === "admins" && !profile.is_admin) return false

    if (!q) return true
    const haystack = [
      profile.username,
      profile.full_name,
      profile.city,
      profile.seller_type,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ka-GE")

    return haystack.includes(q)
  })

  const queryError = profilesResponse.error || listingsResponse.error

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Admin / Users</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              მომხმარებლების მართვა
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              მომხმარებლების, მაღაზიების, ადმინისტრატორებისა და შეზღუდული ანგარიშების ერთიანი ოპერაციული ხედვა.
            </p>
          </div>
          <Link href="/admin" className="ui-btn-secondary">
            ადმინისტრირების მთავარი
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="სულ მომხმარებლები" value={allCount.count ?? 0} />
        <StatCard label="შეზღუდული" value={suspendedCount.count ?? 0} />
        <StatCard label="მაღაზიები" value={storeCount.count ?? 0} />
        <StatCard label="ადმინისტრატორები" value={adminCount.count ?? 0} />
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            name="q"
            defaultValue={typeof params.q === "string" ? params.q : ""}
            className="ui-input"
            placeholder="სახელი, username ან ქალაქი"
          />
          <select name="filter" defaultValue={filter} className="ui-input">
            <option value="all">ყველა მომხმარებელი</option>
            <option value="suspended">შეზღუდული</option>
            <option value="stores">მაღაზიები</option>
            <option value="admins">ადმინისტრატორები</option>
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
        {profiles.length ? (
          profiles.map((profile) => {
            const stats = listingStats.get(profile.id) ?? { all: 0, active: 0 }
            const displayName =
              profile.full_name || profile.username || "სახელი მითითებული არ არის"

            return (
              <article key={profile.id} className="ui-card p-5 sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="ui-pill !px-3 !py-1 text-xs">
                        {profile.seller_type === "store" ? "მაღაზია" : "ფიზიკური გამყიდველი"}
                      </span>
                      {profile.is_seller_verified ? (
                        <span className="ui-pill-soft !px-3 !py-1 text-xs">ვერიფიცირებული</span>
                      ) : null}
                      {profile.is_admin ? (
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                          Admin
                        </span>
                      ) : null}
                      {profile.is_suspended ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                          შეზღუდული
                        </span>
                      ) : null}
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
                        <span className="font-semibold text-text">რეგისტრაცია:</span> {formatDate(profile.created_at)}
                      </div>
                      <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                        <span className="font-semibold text-text">განახლება:</span> {formatDate(profile.updated_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {profile.username ? (
                      <Link
                        href={`/seller/${encodeURIComponent(profile.username)}`}
                        className="ui-btn-primary text-center"
                      >
                        საჯარო პროფილის გახსნა
                      </Link>
                    ) : (
                      <div className="rounded-full border border-line bg-surface-alt px-5 py-3 text-center text-sm font-semibold text-text-soft">
                        საჯარო პროფილი მიუწვდომელია — username არ აქვს
                      </div>
                    )}
                    <Link
                      href="/admin/reports?kind=user&status=all"
                      className="ui-btn-secondary text-center"
                    >
                      მომხმარებლის რეპორტები
                    </Link>
                    <div className="rounded-[1rem] border border-line px-4 py-3 text-xs leading-5 text-text-soft">
                      User ID: {profile.id}
                    </div>
                  </div>
                </div>
              </article>
            )
          })
        ) : (
          <div className="ui-card border-dashed px-6 py-10 text-sm text-text-soft">
            ამ ფილტრით მომხმარებელი ვერ მოიძებნა.
          </div>
        )}
      </section>
    </main>
  )
}
