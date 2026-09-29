import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import StatCard from "@/components/shared/StatCard"

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

function adminActionLabel(value: string) {
  switch (value) {
    case "listing.hide":
      return "განცხადების დამალვა"
    case "listing.restore":
      return "განცხადების აღდგენა"
    case "user.suspend":
      return "მომხმარებლის შეზღუდვა"
    case "user.restore":
      return "მომხმარებლის აღდგენა"
    case "seller.verify":
      return "Seller verification"
    case "seller.unverify":
      return "Seller verification-ის მოხსნა"
    case "category.update":
      return "კატეგორიის განახლება"
    case "support.review":
      return "Support მოთხოვნის დამუშავება"
    case "support.resolve":
      return "Support მოთხოვნის მოგვარება"
    case "support.close":
      return "Support მოთხოვნის დახურვა"
    case "support.reopen":
      return "Support მოთხოვნის ხელახლა გახსნა"
    default:
      return value
  }
}

function moderationActionLabel(value: string) {
  switch (value) {
    case "mark_reviewing":
      return "განხილვაში გადაყვანა"
    case "resolve":
      return "რეპორტის მოგვარება"
    case "dismiss":
      return "რეპორტის უარყოფა"
    case "hide_listing":
      return "განცხადების დამალვა"
    case "hide_story":
      return "Story-ის დამალვა"
    case "suspend_user":
      return "მომხმარებლის შეზღუდვა"
    case "restore_user":
      return "მომხმარებლის აღდგენა"
    default:
      return value
  }
}

export default async function AdminAuditPage() {
  const { supabase } = await requireAdminUser("/dashboard")

  const [adminResponse, moderationResponse, paymentEventsResponse] = await Promise.all([
    supabase
      .from("admin_audit_log")
      .select(
        "id, actor_id, action, target_listing_id, target_user_id, target_category_id, target_support_ticket_id, note, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("moderation_audit_log")
      .select(
        "id, actor_id, report_kind, report_id, action, target_listing_id, target_user_id, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("listing_boost_order_events")
      .select(
        "id, order_id, seller_id, source, event_type, provider_status, message, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  const adminEntries = adminResponse.data ?? []
  const moderationEntries = moderationResponse.data ?? []
  const paymentEvents = paymentEventsResponse.data ?? []

  const profileIds = [
    ...new Set(
      [
        ...adminEntries.map((entry) => entry.actor_id),
        ...adminEntries.map((entry) => entry.target_user_id),
        ...moderationEntries.map((entry) => entry.actor_id),
        ...moderationEntries.map((entry) => entry.target_user_id),
        ...paymentEvents.map((event) => event.seller_id),
      ].filter((value): value is string => Boolean(value)),
    ),
  ]

  const listingIds = [
    ...new Set(
      [
        ...adminEntries.map((entry) => entry.target_listing_id),
        ...moderationEntries.map((entry) => entry.target_listing_id),
      ].filter((value): value is string => Boolean(value)),
    ),
  ]

  const categoryIds = [
    ...new Set(
      adminEntries
        .map((entry) => entry.target_category_id)
        .filter((value): value is number => typeof value === "number"),
    ),
  ]

  const supportTicketIds = [
    ...new Set(
      adminEntries
        .map((entry) => entry.target_support_ticket_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ]

  const [profilesResponse, listingsResponse, categoriesResponse, supportTicketsResponse] = await Promise.all([
    profileIds.length
      ? supabase
          .from("profiles")
          .select("id, username, full_name")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    listingIds.length
      ? supabase
          .from("listings")
          .select("id, slug, title")
          .in("id", listingIds)
      : Promise.resolve({ data: [], error: null }),
    categoryIds.length
      ? supabase
          .from("categories")
          .select("id, name, slug")
          .in("id", categoryIds)
      : Promise.resolve({ data: [], error: null }),
    supportTicketIds.length
      ? supabase
          .from("support_tickets")
          .select("id, subject, status, account_email")
          .in("id", supportTicketIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const profiles = new Map(
    (profilesResponse.data ?? []).map((profile) => [profile.id, profile]),
  )
  const listings = new Map(
    (listingsResponse.data ?? []).map((listing) => [listing.id, listing]),
  )
  const categories = new Map(
    (categoriesResponse.data ?? []).map((category) => [category.id, category]),
  )
  const supportTickets = new Map(
    (supportTicketsResponse.data ?? []).map((ticket) => [ticket.id, ticket]),
  )

  const adminError =
    adminResponse.error ||
    profilesResponse.error ||
    listingsResponse.error ||
    categoriesResponse.error ||
    supportTicketsResponse.error
  const moderationError = moderationResponse.error
  const paymentEventsError = paymentEventsResponse.error

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Admin / Audit</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              Audit Log
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              პირდაპირი admin control-ები, რეპორტებზე დაფუძნებული მოდერაცია და VIP/TBC payment lifecycle-ის მოვლენები ერთ სივრცეში.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/listings" className="ui-btn-secondary">
              განცხადებები
            </Link>
            <Link href="/admin/users" className="ui-btn-secondary">
              მომხმარებლები
            </Link>
            <Link href="/admin/categories" className="ui-btn-secondary">
              კატეგორიები
            </Link>
            <Link href="/admin/support" className="ui-btn-secondary">
              Support
            </Link>
            <Link href="/admin" className="ui-btn-secondary">
              ადმინისტრირების მთავარი
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Admin control events" value={adminEntries.length} />
        <StatCard label="მოდერაციის ჩანაწერები" value={moderationEntries.length} />
        <StatCard label="VIP payment events" value={paymentEvents.length} />
      </section>

      {adminError ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Admin Audit მონაცემების ჩატვირთვა ვერ მოხერხდა: {adminError.message}
        </div>
      ) : null}

      <section className="mt-6">
        <div className="mb-3">
          <div className="ui-eyebrow">Direct admin controls</div>
          <h2 className="mt-2 text-2xl font-black text-text">Admin Audit Log</h2>
        </div>

        <div className="space-y-3">
          {adminEntries.length ? (
            adminEntries.map((entry) => {
              const actor = profiles.get(entry.actor_id)
              const targetUser = entry.target_user_id
                ? profiles.get(entry.target_user_id)
                : null
              const targetListing = entry.target_listing_id
                ? listings.get(entry.target_listing_id)
                : null
              const targetCategory =
                typeof entry.target_category_id === "number"
                  ? categories.get(entry.target_category_id)
                  : null
              const targetSupportTicket = entry.target_support_ticket_id
                ? supportTickets.get(entry.target_support_ticket_id)
                : null

              return (
                <article key={entry.id} className="ui-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-text">
                        {adminActionLabel(entry.action)}
                      </div>
                      <div className="mt-1 text-sm text-text-soft">
                        ადმინისტრატორი: {actor?.full_name || actor?.username || entry.actor_id}
                      </div>
                    </div>
                    <div className="text-xs text-text-soft">{formatDateTime(entry.created_at)}</div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">მომხმარებელი:</span>{" "}
                      {targetUser?.full_name || targetUser?.username || entry.target_user_id || "—"}
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">განცხადება:</span>{" "}
                      {targetListing?.title || entry.target_listing_id || "—"}
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">კატეგორია:</span>{" "}
                      {targetCategory?.name || targetCategory?.slug || entry.target_category_id || "—"}
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">Support:</span>{" "}
                      {targetSupportTicket?.subject || entry.target_support_ticket_id || "—"}
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">შენიშვნა:</span>{" "}
                      {entry.note || "—"}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {targetListing?.slug ? (
                      <Link
                        href={`/listing/${targetListing.slug}`}
                        className="ui-btn-secondary"
                      >
                        განცხადების გახსნა
                      </Link>
                    ) : null}
                    {targetSupportTicket ? (
                      <Link href="/admin/support" className="ui-btn-secondary">
                        Support Inbox
                      </Link>
                    ) : null}
                  </div>
                </article>
              )
            })
          ) : (
            <div className="ui-card border-dashed px-6 py-10 text-sm text-text-soft">
              პირდაპირი admin მოქმედებები ჯერ არ დაფიქსირებულა.
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="ui-eyebrow">Moderation reports</div>
            <h2 className="mt-2 text-2xl font-black text-text">რეპორტებზე დაფუძნებული მოქმედებები</h2>
          </div>
          <Link href="/admin/reports" className="ui-btn-secondary">
            რეპორტები
          </Link>
        </div>

        {moderationError ? (
          <div className="mb-3 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Moderation Audit მონაცემების ჩატვირთვა ვერ მოხერხდა: {moderationError.message}
          </div>
        ) : null}

        <div className="space-y-3">
          {moderationEntries.length ? (
            moderationEntries.map((entry) => {
              const actor = profiles.get(entry.actor_id)
              const targetUser = entry.target_user_id
                ? profiles.get(entry.target_user_id)
                : null
              const targetListing = entry.target_listing_id
                ? listings.get(entry.target_listing_id)
                : null

              return (
                <article key={entry.id} className="ui-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-text">
                        {moderationActionLabel(entry.action)}
                      </div>
                      <div className="mt-1 text-sm text-text-soft">
                        ადმინისტრატორი: {actor?.full_name || actor?.username || entry.actor_id}
                      </div>
                    </div>
                    <div className="text-xs text-text-soft">{formatDateTime(entry.created_at)}</div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">ტიპი:</span> {entry.report_kind}
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">მომხმარებელი:</span>{" "}
                      {targetUser?.full_name || targetUser?.username || entry.target_user_id || "—"}
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">განცხადება:</span>{" "}
                      {targetListing?.title || entry.target_listing_id || "—"}
                    </div>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="ui-card border-dashed px-6 py-10 text-sm text-text-soft">
              მოდერაციის audit ჩანაწერები ჯერ არ არის.
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3">
          <div className="ui-eyebrow">Payments</div>
          <h2 className="mt-2 text-2xl font-black text-text">VIP / TBC lifecycle events</h2>
        </div>

        {paymentEventsError ? (
          <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Payment event-ების წაკითხვა ვერ მოხერხდა: {paymentEventsError.message}
          </div>
        ) : null}

        <div className="space-y-3">
          {paymentEvents.length ? (
            paymentEvents.map((event) => {
              const seller = profiles.get(event.seller_id)
              return (
                <article key={event.id} className="ui-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-text">{event.event_type}</div>
                      <div className="mt-1 text-sm text-text-soft">
                        {seller?.full_name || seller?.username || event.seller_id} · {event.source}
                      </div>
                    </div>
                    <div className="text-xs text-text-soft">{formatDateTime(event.created_at)}</div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">Order:</span> {event.order_id}
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">Provider status:</span>{" "}
                      {event.provider_status || "—"}
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <span className="font-semibold text-text">Message:</span> {event.message || "—"}
                    </div>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="ui-card border-dashed px-6 py-10 text-sm text-text-soft">
              Payment lifecycle event-ები ჯერ არ არის.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
