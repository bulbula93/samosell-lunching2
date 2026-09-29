import { requireAdminUser } from "@/lib/auth"
import Link from "next/link"
import StatCard from "@/components/shared/StatCard"
import { reconcileExpiredBoostOrders } from "@/lib/boost-reconciliation"

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ flash?: string | string[] }> }) {
  const params = (await searchParams) ?? {}
  const flash = typeof params.flash === "string" ? params.flash : ""

  const { supabase } = await requireAdminUser("/dashboard")
  await reconcileExpiredBoostOrders()
  const nowIso = new Date().toISOString()
  const overdueCutoff = new Date(
    new Date(nowIso).getTime() - 24 * 60 * 60 * 1000,
  ).toISOString()

  const [
    { count: openListingReports },
    { count: openUserReports },
    { count: reviewingListingReports },
    { count: reviewingUserReports },
    { count: openStoryReports },
    { count: reviewingStoryReports },
    { count: overdueListingReports },
    { count: overdueUserReports },
    { count: overdueStoryReports },
    { count: suspendedUsers },
    { count: storeCount },
    { count: activeListings },
    { count: pendingBoosts },
    { count: activeBoosts },
    { count: failedPayments },
    { count: pendingFlittPayments },
    { count: pendingAds },
    { count: failedAdRefunds },
    { count: openSupportTickets },
    { count: reviewingSupportTickets },
    { data: storeProfiles },
  ] = await Promise.all([
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("story_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("story_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]).lte("created_at", overdueCutoff),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]).lte("created_at", overdueCutoff),
    supabase.from("story_reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]).lte("created_at", overdueCutoff),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_suspended", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("seller_type", "store"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).in("status", ["pending_payment", "under_review", "approved"]),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("status", "active").gt("ends_at", nowIso),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").in("status", ["declined", "expired", "failed"]),
    supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("mode", "live").eq("status", "pending"),
    supabase.from("ads").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
    supabase.from("ad_orders").select("id", { count: "exact", head: true }).eq("refund_status", "failed"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase
      .from("profiles")
      .select("id, username, full_name, store_logo_url, store_phone, store_address, store_hours")
      .eq("seller_type", "store")
      .limit(500),
  ])

  const overdueReports =
    (overdueListingReports ?? 0) +
    (overdueUserReports ?? 0) +
    (overdueStoryReports ?? 0)

  const incompleteStores = (storeProfiles ?? []).filter((profile) =>
    [
      profile.username,
      profile.full_name,
      profile.store_logo_url,
      profile.store_phone,
      profile.store_address,
      profile.store_hours,
    ].some((value) => !String(value ?? "").trim()),
  ).length

  const operationalAlerts = [
    {
      label: "24სთ+ მოდერაციის backlog",
      count: overdueReports,
      href: "/admin/reports?status=all&age=overdue&sort=oldest",
      detail: "ღია ან განხილვაში მყოფი რეპორტები, რომლებიც 24 საათზე ძველია.",
    },
    {
      label: "წარუმატებელი გადახდები",
      count: failedPayments ?? 0,
      href: "/admin/payments?status=failed",
      detail: "Flitt live ტრანზაქციები, რომლებიც declined, expired ან failed მდგომარეობაშია.",
    },
    {
      label: "Flitt გადახდები მოლოდინში",
      count: pendingFlittPayments ?? 0,
      href: "/admin/payments?status=pending",
      detail: "Flitt live ტრანზაქციები, რომლებიც provider-ის საბოლოო სტატუსს ჯერ ელოდება.",
    },
    {
      label: "რეკლამები განხილვისთვის",
      count: pendingAds ?? 0,
      href: "/admin/ads",
      detail: "Pending review სტატუსის მქონე სარეკლამო მასალები.",
    },
    {
      label: "რეკლამის refund შეცდომები",
      count: failedAdRefunds ?? 0,
      href: "/admin/ads",
      detail: "რეკლამის შეკვეთები, სადაც ავტომატური refund ჩავარდა.",
    },
    {
      label: "Support მოთხოვნები",
      count: (openSupportTickets ?? 0) + (reviewingSupportTickets ?? 0),
      href: "/admin/support",
      detail: "ახალი ან დამუშავებაში მყოფი მომხმარებლის მხარდაჭერის მოთხოვნები.",
    },
    {
      label: "არასრულად შევსებული მაღაზიები",
      count: incompleteStores,
      href: "/admin/stores?filter=incomplete",
      detail: "Store პროფილები, რომლებსაც ძირითადი საჯარო ინფორმაცია აკლიათ.",
    },
  ]

  const attentionCount = operationalAlerts.reduce(
    (sum, item) => sum + item.count,
    0,
  )

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">ადმინისტრირება</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">ადმინისტრირების პანელი</h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              აქედან აკონტროლებ რეპორტებს, პრობლემურ განცხადებებს, მომხმარებელთა შეზღუდვებს, VIP განთავსებას და search relevance-ის რეალურ ქცევით სიგნალებს.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin/listings" className="ui-btn-primary">
              განცხადებები
            </Link>
            <Link href="/admin/users" className="ui-btn-primary">
              მომხმარებლები
            </Link>
            <Link href="/admin/stores" className="ui-btn-primary">
              მაღაზიები
            </Link>
            <Link href="/admin/categories" className="ui-btn-primary">
              კატეგორიები
            </Link>
            <Link href="/admin/audit" className="ui-btn-secondary">
              Audit Log
            </Link>
            <Link href="/admin/payments" className="ui-btn-primary">
              გადახდების მართვა
            </Link>
            <Link href="/admin/ads" className="ui-btn-primary">
              რეკლამების მართვა
            </Link>
            <Link href="/admin/agent" className="ui-btn-primary">
              Admin Agent
            </Link>
            <Link href="/admin/reports" className="ui-btn-secondary">
              რეპორტების ნახვა
            </Link>
            <Link href="/admin/boosts" className="ui-btn-secondary">
              VIP განთავსების მართვა
            </Link>
            <Link href="/admin/search" className="ui-btn-secondary">
              Search Analytics
            </Link>
            <Link href="/admin/support" className="ui-btn-secondary">
              Support Inbox
            </Link>
            <Link href="/admin/system" className="ui-btn-secondary">
              System Status
            </Link>
          </div>
        </div>
      </section>

      {flash ? (
        <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {flash}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="ღია რეპორტები" value={(openListingReports ?? 0) + (openUserReports ?? 0) + (openStoryReports ?? 0)} />
        <StatCard label="დამუშავებაში" value={(reviewingListingReports ?? 0) + (reviewingUserReports ?? 0) + (reviewingStoryReports ?? 0)} />
        <StatCard label="შეზღუდული მომხმარებლები" value={suspendedUsers ?? 0} />
        <StatCard label="მაღაზიები" value={storeCount ?? 0} />
        <StatCard label="აქტიური განცხადებები" value={activeListings ?? 0} />
        <StatCard label="მოლოდინში მყოფი მოთხოვნები" value={pendingBoosts ?? 0} />
        <StatCard label="აქტიური VIP" value={activeBoosts ?? 0} />
        <StatCard label="ღია Support" value={(openSupportTickets ?? 0) + (reviewingSupportTickets ?? 0)} />
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="ui-eyebrow">Operations</div>
            <h2 className="mt-2 text-2xl font-black text-text">
              ოპერაციული გაფრთხილებები
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-soft">
              ყურადღების მომთხოვნი moderation, payment, ads და store სიგნალები ერთ სივრცეში.
            </p>
          </div>
          <div className={attentionCount > 0
            ? "rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900"
            : "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800"}>
            {attentionCount > 0 ? `${attentionCount} საკითხი` : "ყველაფერი სუფთაა"}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {operationalAlerts.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-[1.2rem] border border-line bg-surface-alt p-4 transition hover:border-brand/40 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-bold text-text">{item.label}</div>
                <span className={item.count > 0
                  ? "rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-900"
                  : "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800"}>
                  {item.count}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-text-soft">{item.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="ui-card p-6">
          <div className="ui-eyebrow">რეკლამები</div>
          <h2 className="mt-3 text-2xl font-black text-text">7-დღიანი სარეკლამო განთავსება</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-text-soft">
            <p>• რეკლამის მონაცემებისა და სურათის მონახაზად შენახვა.</p>
            <p>• ერთი დაჭერით გაშვება ზუსტად 7 დღით.</p>
            <p>• ავტომატური ვადის დასრულება და ხელით შეჩერება.</p>
          </div>
          <Link href="/admin/ads" className="ui-btn-secondary mt-5">რეკლამების გახსნა</Link>
        </div>

        <div className="ui-card p-6">
          <div className="ui-eyebrow">მოდერაცია</div>
          <h2 className="mt-3 text-2xl font-black text-text">რაზე გაქვს ყველაზე მეტი კონტროლი</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-text-soft">
            <p>• ახალი და მიმდინარე რეპორტების სწრაფი განხილვა.</p>
            <p>• პრობლემური განცხადების დამალვა ან გამყიდველის შეზღუდვა.</p>
            <p>• უკვე შეზღუდული ანგარიშების აღდგენა საჭიროების შემთხვევაში.</p>
          </div>
        </div>

        <div className="ui-card p-6">
          <div className="ui-eyebrow">VIP განთავსება</div>
          <h2 className="mt-3 text-2xl font-black text-text">გადახდისა და boost მოთხოვნების კონტროლი</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-text-soft">
            <p>• Flitt live payment სტატუსების, callback-ებისა და provider verification-ის კონტროლი.</p>
            <p>• მოთხოვნის გააქტიურება, უარყოფა ან reviewing რეჟიმში გადატანა.</p>
            <p>• მთავარ ბლოკში featured პოზიციის მინიჭება კონკრეტულ განცხადებაზე.</p>
          </div>
        </div>

        <div className="ui-card p-6">
          <div className="ui-eyebrow">Search relevance</div>
          <h2 className="mt-3 text-2xl font-black text-text">Ranking feedback loop</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-text-soft">
            <p>• Zero-result query-ების აღმოჩენა და taxonomy gap-ების დანახვა.</p>
            <p>• Result position CTR, favorite და chat conversion-ის შედარება.</p>
            <p>• Ranking weights-ის ცვლილება მხოლოდ versioned და admin-controlled config-ით.</p>
          </div>
          <Link href="/admin/search" className="ui-btn-secondary mt-5">ანალიტიკის გახსნა</Link>
        </div>
      </section>
    </main>
  )
}
