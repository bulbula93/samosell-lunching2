import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationAction,
} from "@/app/dashboard/notifications/actions"
import PushPwaSettings from "@/components/pwa/PushPwaSettings"
import UiPageHeader from "@/components/shared/UiPageHeader"
import UiEmptyState from "@/components/shared/UiEmptyState"
import { requireAuthenticatedUser } from "@/lib/auth"

type NotificationRow = {
  id: string
  type: string
  title: string
  body: string | null
  href: string | null
  read_at: string | null
  created_at: string
}

function formatNotificationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return new Intl.DateTimeFormat("ka-GE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function notificationIcon(type: string) {
  if (type === "chat_started" || type === "chat_message") return "✉"
  if (type === "saved_search_match") return "⌕"
  if (
    type === "offer_created" ||
    type === "offer_accepted" ||
    type === "offer_rejected" ||
    type === "reservation_created" ||
    type === "reservation_released"
  ) return "₾"
  if (
    type === "review_request" ||
    type === "review_completed" ||
    type === "review_received" ||
    type === "review_request_canceled"
  ) return "★"
  if (type === "price_drop") return "₾"
  if (type === "favorite_activity") return "♡"
  if (type === "listing_stale") return "↻"
  if (type === "boost_expiry") return "VIP"
  return "•"
}

function readStatusLabel(type: string) {
  if (type === "review_completed") return "დასრულებულია"
  if (type === "review_request_canceled") return "გაუქმებულია"
  return "წაკითხულია"
}

export default async function DashboardNotificationsPage() {
  const { supabase } = await requireAuthenticatedUser("/dashboard/notifications")
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, href, read_at, created_at")
    .not("type", "in", "(chat_started,chat_message)")
    .order("created_at", { ascending: false })
    .limit(80)

  if (error) throw new Error("Notifications could not be loaded.")

  const notifications = (data ?? []) as NotificationRow[]
  const unreadCount = notifications.filter((item) => !item.read_at).length

  return (
    <main className="min-h-screen bg-bg px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <UiPageHeader
          eyebrow="განახლებები"
          title="შეტყობინებები"
          description="აქ გამოჩნდება შენახული ძებნების, შეთავაზებების, VIP-ის ვადის, განცხადების აქტუალურობის, ფავორიტებისა და სხვა მნიშვნელოვანი მოვლენების შეტყობინებები."
          actions={unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="ui-btn-secondary whitespace-nowrap">
                ყველა წაკითხულად
              </button>
            </form>
          ) : null}
        />

        <div className="mt-6"><PushPwaSettings /></div>

        {notifications.length === 0 ? (
          <div className="mt-6">
            <UiEmptyState
              icon="✓"
              title="ჯერ შეტყობინებები არ გაქვს"
              description="ახალი შეთავაზება, ფასის ცვლილება, VIP-ის ვადა, ფავორიტი ან განცხადების განახლების reminder აქ გამოჩნდება."
            />
          </div>
        ) : (
          <section className="mt-6 space-y-3" aria-label="შეტყობინებების სია">
            {notifications.map((notification) => {
              const unread = !notification.read_at
              return (
                <article
                  key={notification.id}
                  className={`ui-card flex gap-4 p-4 sm:p-5 ${unread ? "border-brand/35 bg-brand-soft/20" : ""}`}
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black ${unread ? "bg-brand text-white" : "bg-surface-alt text-text-soft"}`}>
                    {notificationIcon(notification.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <h2 className="text-base font-black text-text">{notification.title}</h2>
                      <time className="shrink-0 text-xs font-semibold text-text-soft" dateTime={notification.created_at}>
                        {formatNotificationTime(notification.created_at)}
                      </time>
                    </div>
                    {notification.body ? (
                      <p className="mt-1 text-sm leading-6 text-text-soft">{notification.body}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {notification.href ? (
                        <form action={openNotificationAction}>
                          <input type="hidden" name="notificationId" value={notification.id} />
                          <input type="hidden" name="href" value={notification.href} />
                          <button type="submit" className="ui-btn-primary min-h-10 px-4 py-2 text-sm">
                            გახსნა
                          </button>
                        </form>
                      ) : null}
                      {unread ? (
                        <form action={markNotificationReadAction}>
                          <input type="hidden" name="notificationId" value={notification.id} />
                          <button type="submit" className="ui-btn-ghost min-h-10 px-3 py-2 text-sm">
                            წაკითხულად მონიშვნა
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs font-bold text-text-soft">{readStatusLabel(notification.type)}</span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}
