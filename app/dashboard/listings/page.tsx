import { requireAuthenticatedUser } from "@/lib/auth"
import Link from "next/link"
import { activePromotionBadges, formatDateOnly } from "@/lib/boosts"
import { conditionLabel, listingStatusLabel } from "@/lib/listings"
import { deleteListingAction, updateListingStatusAction } from "@/app/dashboard/listings/actions"
import SmartImage from "@/components/shared/SmartImage"
import DeleteListingInlineButton from "@/components/dashboard/DeleteListingInlineButton"

const statusTabs = [
  { key: "all", label: "ყველა" },
  { key: "draft", label: "დრაფტები" },
  { key: "active", label: "აქტიური" },
  { key: "sold", label: "გაყიდული" },
  { key: "archived", label: "არქივი" },
] as const

function flashMessageLabel(value?: string) {
  switch (value) {
    case "published": return "განცხადება გამოქვეყნდა."
    case "draft": return "განცხადება დრაფტში გადავიდა."
    case "sold": return "განცხადება გაყიდულად მოინიშნა."
    case "archived": return "განცხადება არქივში გადავიდა."
    case "updated": return "განცხადება წარმატებით განახლდა."
    case "deleted": return "განცხადება მთლიანად წაიშალა საიტიდან."
    case "1": return "ოპერაცია წარმატებით შესრულდა."
    case "created": return "განცხადება წარმატებით შეიქმნა."
    default: return value || ""
  }
}

export default async function DashboardListingsPage({ searchParams }: { searchParams?: Promise<{ created?: string | string[]; updated?: string | string[]; status?: string | string[]; flash?: string | string[] }> }) {
  const params = (await searchParams) ?? {}
  const activeTab = typeof params.status === "string" ? params.status : "all"
  const flashRaw = typeof params.flash === "string" ? params.flash : undefined
  const created = typeof params.created === "string" ? params.created : undefined
  const updated = typeof params.updated === "string" ? params.updated : undefined

  const { supabase, user } = await requireAuthenticatedUser("/dashboard/listings")

  const baseQuery = supabase.from("listings").select("id, title, slug, price, currency, condition, status, created_at, published_at, cover_image_url, is_vip, vip_until, promoted_until, featured_until, featured_slot").eq("seller_id", user.id).order("created_at", { ascending: false })
  const listingsQuery = activeTab === "all" ? baseQuery : baseQuery.eq("status", activeTab)

  const [{ data: listings }, { count: allCount }, { count: draftCount }, { count: activeCount }, { count: soldCount }, { count: archivedCount }] = await Promise.all([
    listingsQuery,
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", user.id),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "draft"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "active"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "sold"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "archived"),
  ])

  const counts: Record<string, number> = { all: allCount ?? 0, draft: draftCount ?? 0, active: activeCount ?? 0, sold: soldCount ?? 0, archived: archivedCount ?? 0 }
  const flashMessage = flashRaw ? flashMessageLabel(flashRaw) : created ? "განცხადება წარმატებით შეიქმნა." : updated ? "განცხადება წარმატებით განახლდა." : ""

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">განცხადებები</div>
          <h1 className="mt-3 text-4xl font-black">ჩემი განცხადებები</h1>
          <p className="mt-3 max-w-2xl text-neutral-600">აქედან მართავ საკუთარ განცხადებებს: აქვეყნებ, არედაქტირებ, არქივში გადაგაქვს, გაყიდულად ნიშნავ და სურვილის შემთხვევაში აძლიერებ ხილვადობას.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/billing" className="rounded-full border border-neutral-300 px-4 py-2 font-semibold text-neutral-700">VIP განთავსების შეკვეთები</Link>
          <Link href="/dashboard/listings/new" className="rounded-full bg-black px-4 py-2 font-semibold text-white">ახალი განცხადება</Link>
        </div>
      </div>

      {flashMessage ? <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{flashMessage}</div> : null}

      <div className="mb-6 flex flex-wrap gap-3">{statusTabs.map((tab) => <Link key={tab.key} href={tab.key === "all" ? "/dashboard/listings" : `/dashboard/listings?status=${tab.key}`} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab.key ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}>{tab.label} ({counts[tab.key] ?? 0})</Link>)}</div>

      <div className="space-y-4">
        {listings && listings.length > 0 ? listings.map((item) => {
          const badges = activePromotionBadges(item)
          return (
            <div key={item.id} className="grid gap-4 rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm lg:grid-cols-[120px_1fr_auto] lg:items-center">
              <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-200"><SmartImage src={item.cover_image_url} alt={item.title} wrapperClassName="h-full w-full" fallbackLabel="სურათი არ არის" /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-lg font-bold text-neutral-900">{item.title}</div>
                  {badges.map((badge) => <span key={badge} className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700">{badge}</span>)}
                </div>
                <div className="mt-1 text-sm text-neutral-500">{item.price} {item.currency === "GEL" ? "₾" : item.currency} · {conditionLabel(item.condition)} · {listingStatusLabel(item.status)}</div>
                <div className="mt-1 text-xs text-neutral-400">შექმნილია: {formatDateOnly(item.created_at)}</div>
                <div className="mt-1 text-xs text-neutral-400">{item.published_at ? `გამოქვეყნდა: ${formatDateOnly(item.published_at)}` : "ჯერ არ არის გამოქვეყნებული"}</div>
              </div>
              <div className="flex flex-col gap-2 lg:items-end">
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Link href={`/dashboard/listings/${item.id}/promote`} className="rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900">VIP განთავსება</Link>
                  <Link href={`/dashboard/listings/${item.id}/edit`} className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">რედაქტირება</Link>
                  <Link href={`/listing/${item.slug}`} className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">საჯარო გვერდი</Link>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {item.status !== "active" ? <form action={updateListingStatusAction}><input type="hidden" name="listingId" value={item.id} /><input type="hidden" name="intent" value={item.status === "sold" || item.status === "archived" ? "reactivate" : "publish"} /><input type="hidden" name="filter" value={activeTab} /><button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">გამოქვეყნება</button></form> : <form action={updateListingStatusAction}><input type="hidden" name="listingId" value={item.id} /><input type="hidden" name="intent" value="unpublish" /><input type="hidden" name="filter" value={activeTab} /><button className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">დრაფტში დაბრუნება</button></form>}
                  {item.status !== "sold" ? <form action={updateListingStatusAction}><input type="hidden" name="listingId" value={item.id} /><input type="hidden" name="intent" value="sold" /><input type="hidden" name="filter" value={activeTab} /><button className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">გაყიდულია</button></form> : null}
                  {item.status !== "archived" ? <form action={updateListingStatusAction}><input type="hidden" name="listingId" value={item.id} /><input type="hidden" name="intent" value="archive" /><input type="hidden" name="filter" value={activeTab} /><button className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">არქივში გადატანა</button></form> : null}
                  <DeleteListingInlineButton listingId={item.id} listingTitle={item.title} filter={activeTab} action={deleteListingAction} />
                </div>
              </div>
            </div>
          )
        }) : <div className="rounded-[2rem] border border-neutral-200 bg-white px-6 py-10 text-sm text-neutral-600 shadow-sm">ამ სტატუსში განცხადება არ მოიძებნა.</div>}
      </div>
    </main>
  )
}
