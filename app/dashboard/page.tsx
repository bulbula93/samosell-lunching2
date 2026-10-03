import Link from "next/link"
import Avatar from "@/components/shared/Avatar"
import StatCard from "@/components/shared/StatCard"
import UiPageHeader from "@/components/shared/UiPageHeader"
import { getSellerVisualAvatar, sellerTypeLabel } from "@/lib/profiles"
import { createClient } from "@/lib/supabase/server"
import { reconcileExpiredBoostOrders } from "@/lib/boost-reconciliation"

const dashboardStats = [
  { label: "სულ განცხადებები", iconName: "listings", getHref: () => "/dashboard/listings" },
  { label: "დრაფტები", iconName: "drafts", getHref: () => "/dashboard/listings?status=draft" },
  { label: "ფავორიტები", iconName: "favorites", getHref: () => "/dashboard/favorites" },
  { label: "ჩათები", iconName: "chats", getHref: () => "/dashboard/chats" },
  { label: "შეკვეთები", iconName: "orders", getHref: () => "/dashboard/orders" },
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
  await reconcileExpiredBoostOrders()
  const nowIso = new Date().toISOString()
  const chatFilter = `buyer_id.eq.${userId},seller_id.eq.${userId}`

  const [
    { count: listingsCount },
    { count: draftCount },
    { count: favoritesCount },
    { count: chatsCount },
    { count: ordersCount },
    { count: reportsCount },
    { count: boostOrdersCount },
    { count: activeBoostsCount },
    { data: profile },
  ] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", userId),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", userId).eq("status", "draft"),
    supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("chat_threads").select("id", { count: "exact", head: true }).or(chatFilter),
    supabase.from("marketplace_orders").select("id", { count: "exact", head: true }).or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("reporter_id", userId),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("seller_id", userId),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("seller_id", userId).eq("status", "active").gt("ends_at", nowIso),
    supabase.from("profiles").select("username, full_name, city, bio, is_admin, avatar_url, seller_type, store_logo_url, store_phone, store_instagram, store_hours, store_address").eq("id", userId).maybeSingle(),
  ])

  const statValues = [
    listingsCount ?? 0,
    draftCount ?? 0,
    favoritesCount ?? 0,
    chatsCount ?? 0,
    ordersCount ?? 0,
    reportsCount ?? 0,
    boostOrdersCount ?? 0,
    activeBoostsCount ?? 0,
  ]

  return (
    <main className="ui-page-shell">
      <div className="ui-page-container max-w-7xl">
        <UiPageHeader
          eyebrow="კაბინეტი"
          title={<>გამარჯობა{profile?.full_name ? `, ${profile.full_name}` : ""}</>}
          description={<>{sellerTypeLabel(profile?.seller_type)} • აქედან მართავ პროფილს, განცხადებებს, ფავორიტებს, შეტყობინებებს და VIP განთავსების შეკვეთებს.</>}
          leading={<Avatar src={getSellerVisualAvatar(profile)} alt={profile?.full_name || profile?.username || "პროფილი"} fallbackText={profile?.full_name || profile?.username || "SS"} sizeClassName="h-20 w-20" textClassName="text-2xl" />}
          actions={
            <>
              <Link href="/dashboard/profile" className="ui-btn-secondary">პროფილი</Link>
              <Link href="/dashboard/billing" className="ui-btn-secondary">VIP შეკვეთები</Link>
              {profile?.is_admin ? <Link href="/admin" className="ui-btn-secondary !border-amber-300 !bg-amber-50 !text-amber-900">ადმინი</Link> : null}
              <Link href="/dashboard/listings/new" className="ui-btn-primary">ახალი განცხადება</Link>
            </>
          }
        />

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((item, index) => (
          <StatCard key={item.label} label={item.label} value={statValues[index]} href={item.getHref()} iconName={item.iconName} />
        ))}
      </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="ui-card p-6">
          <p className="ui-eyebrow">პროფილი</p>
          <h2 className="mt-2 text-2xl font-black text-text">პროფილის მოკლე ინფორმაცია</h2>
          <div className="mt-5 space-y-3 text-sm text-text-soft">
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

        <section className="ui-card p-6">
          <p className="ui-eyebrow">შემდეგი ნაბიჯები</p>
          <h2 className="mt-2 text-2xl font-black text-text">რა შეგიძლია გააკეთო შემდეგ</h2>
          <div className="mt-5 space-y-3 text-sm leading-6 text-text-soft">
            <p>1. პროფილში დაამატე ავატარი, ანგარიშის ტიპი და საჯარო აღწერა.</p>
            <p>2. შექმენი განცხადება რამდენიმე ფოტოთი ან გააუმჯობესე არსებული აღწერა.</p>
            <p>3. თუ მეტი ხილვადობა გინდა, კონკრეტულ ნივთზე ჩართე VIP განთავსება.</p>
            <p>4. VIP განთავსების გვერდზე ნახე მიმდინარე და დასრულებული შეკვეთები.</p>
            <p>5. მოლაპარაკება აწარმოე ჩათებით — განცხადების გვერდიდან ან ინბოქსიდან.</p>
            <p>6. პრობლემური განცხადებების სტატუსს რეპორტების გვერდზე გადაამოწმებ.</p>
          </div>
        </section>
        </div>
      </div>
    </main>
  )
}
