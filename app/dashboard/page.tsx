import Link from "next/link"
import Avatar from "@/components/shared/Avatar"
import StatCard from "@/components/shared/StatCard"
import { getSellerVisualAvatar, sellerTypeLabel } from "@/lib/profiles"
import { createClient } from "@/lib/supabase/server"

const dashboardStats = [
  { label: "სულ განცხადებები", iconName: "listings", getHref: () => "/dashboard/listings" },
  { label: "დრაფტები", iconName: "drafts", getHref: () => "/dashboard/listings?status=draft" },
  { label: "ფავორიტები", iconName: "favorites", getHref: () => "/dashboard/favorites" },
  { label: "ჩათები", iconName: "chats", getHref: () => "/dashboard/chats" },
  { label: "რეპორტები", iconName: "reports", getHref: () => "/dashboard/reports" },
  { label: "VIP განთავსების შეკვეთები", iconName: "vipOrders", getHref: () => "/dashboard/billing" },
  { label: "აქტიური VIP", iconName: "activeVip", getHref: () => "/dashboard/billing?status=active" },
] as const

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user!.id
  const chatFilter = `buyer_id.eq.${userId},seller_id.eq.${userId}`

  const [
    { count: listingsCount },
    { count: draftCount },
    { count: favoritesCount },
    { count: chatsCount },
    { count: reportsCount },
    { count: boostOrdersCount },
    { count: activeBoostsCount },
    { data: profile },
  ] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", userId),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", userId).eq("status", "draft"),
    supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("chat_threads").select("id", { count: "exact", head: true }).or(chatFilter),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("reporter_id", userId),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("seller_id", userId),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("seller_id", userId).eq("status", "active"),
    supabase.from("profiles").select("username, full_name, city, bio, is_admin, avatar_url, seller_type, store_logo_url, store_phone, store_instagram, store_hours, store_address").eq("id", userId).maybeSingle(),
  ])

  const statValues = [
    listingsCount ?? 0,
    draftCount ?? 0,
    favoritesCount ?? 0,
    chatsCount ?? 0,
    reportsCount ?? 0,
    boostOrdersCount ?? 0,
    activeBoostsCount ?? 0,
  ]

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar src={getSellerVisualAvatar(profile)} alt={profile?.full_name || profile?.username || "პროფილი"} fallbackText={profile?.full_name || profile?.username || "SS"} sizeClassName="h-20 w-20" textClassName="text-2xl" />
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">კაბინეტი</div>
            <h1 className="mt-3 text-4xl font-black">გამარჯობა{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
            <p className="mt-2 max-w-2xl text-neutral-600">{sellerTypeLabel(profile?.seller_type)} • აქედან მართავ პროფილს, განცხადებებს, ფავორიტებს, შეტყობინებებს და VIP განთავსების შეკვეთებს.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/profile" className="rounded-full border border-neutral-300 px-4 py-2 font-semibold text-neutral-700">პროფილი</Link>
          <Link href="/dashboard/billing" className="rounded-full border border-neutral-300 px-4 py-2 font-semibold text-neutral-700">VIP განთავსების შეკვეთები</Link>
          {profile?.is_admin ? <Link href="/admin" className="rounded-full border border-amber-300 px-4 py-2 font-semibold text-amber-900">ადმინი</Link> : null}
          <Link href="/dashboard/listings/new" className="rounded-full bg-black px-4 py-2 font-semibold text-white">ახალი განცხადება</Link>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((item, index) => (
          <StatCard key={item.label} label={item.label} value={statValues[index]} href={item.getHref()} iconName={item.iconName} />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black">პროფილის მოკლე ინფორმაცია</h2>
          <div className="mt-5 space-y-3 text-sm text-neutral-700">
            <div><span className="font-semibold">ანგარიშის ტიპი:</span> {sellerTypeLabel(profile?.seller_type)}</div>
            <div><span className="font-semibold">მომხმარებლის სახელი:</span> {profile?.username || "ჯერ არ არის შევსებული"}</div>
            <div><span className="font-semibold">ქალაქი:</span> {profile?.city || "—"}</div>
            <div><span className="font-semibold">შესახებ:</span> {profile?.bio || "—"}</div>
            {profile?.seller_type === "store" ? <div><span className="font-semibold">ტელეფონი:</span> {profile?.store_phone || "—"}</div> : null}
            {profile?.seller_type === "store" ? <div><span className="font-semibold">Instagram:</span> {profile?.store_instagram || "—"}</div> : null}
            {profile?.seller_type === "store" ? <div><span className="font-semibold">სამუშაო საათები:</span> {profile?.store_hours || "—"}</div> : null}
            {profile?.seller_type === "store" ? <div><span className="font-semibold">მისამართი:</span> {profile?.store_address || "—"}</div> : null}
          </div>
        </section>

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black">რა შეგიძლია გააკეთო შემდეგ</h2>
          <div className="mt-5 space-y-3 text-sm leading-6 text-neutral-700">
            <p>1. პროფილში დაამატე ავატარი, ანგარიშის ტიპი და საჯარო აღწერა.</p>
            <p>2. შექმენი განცხადება რამდენიმე ფოტოთი ან გააუმჯობესე არსებული აღწერა.</p>
            <p>3. თუ მეტი ხილვადობა გინდა, კონკრეტულ ნივთზე ჩართე VIP განთავსება.</p>
            <p>4. VIP განთავსების გვერდზე ნახე მიმდინარე და დასრულებული შეკვეთები.</p>
            <p>5. მოლაპარაკება აწარმოე ჩათებით — განცხადების გვერდიდან ან ინბოქსიდან.</p>
            <p>6. პრობლემური განცხადებების სტატუსს რეპორტების გვერდზე გადაამოწმებ.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
