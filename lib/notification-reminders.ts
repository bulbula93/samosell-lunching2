export type ReminderListing = {
  id: string; seller_id: string; slug: string; title: string; status: string
  updated_at: string | null; vip_until: string | null; favorites_count: number | null
}
export type SellerReminder = { id: string; title: string; body: string; href: string; icon: string }
const DAY = 86_400_000

/** Read-only, owner-scoped hints: no notification rows, pushes or emails. */
export function buildSellerReminders(listings: ReminderListing[], userId: string, now = Date.now()): SellerReminder[] {
  const reminders: SellerReminder[] = []
  for (const listing of listings) {
    if (listing.seller_id !== userId || listing.status !== "active") continue
    const expiry = listing.vip_until ? Date.parse(listing.vip_until) : NaN
    const updated = listing.updated_at ? Date.parse(listing.updated_at) : NaN
    const href = `/dashboard/listings/${encodeURIComponent(listing.id)}/edit`
    if (expiry > now && expiry <= now + DAY) {
      reminders.push({ id: `vip:${listing.id}:${listing.vip_until}`, title: "VIP იწურება", body: `„${listing.title}“-ის VIP მომდევნო 24 საათში დასრულდება. სურვილის შემთხვევაში გააგრძელე.`, href: `/dashboard/listings/${encodeURIComponent(listing.id)}/promote`, icon: "VIP" })
    } else if (Number.isFinite(updated) && updated <= now - 7 * DAY) {
      reminders.push({ id: `stale:${listing.id}`, title: "განცხადების გადახედვის დროა", body: `„${listing.title}“ მინიმუმ 7 დღეა არ განახლებულა. გადაამოწმე ფასი და აღწერა — შეიძლება ყველაფერი ისევ სწორია.`, href, icon: "↻" })
    }
    if (Number.isSafeInteger(listing.favorites_count) && Number(listing.favorites_count) > 0) {
      reminders.push({ id: `favorite:${listing.id}`, title: "შენი ნივთი რჩეულებშია", body: `„${listing.title}“ ${listing.favorites_count} მომხმარებელს აქვს რჩეულებში.`, href: `/listing/${encodeURIComponent(listing.slug)}`, icon: "♡" })
    }
  }
  return reminders.sort((a, b) => Number(b.icon === "VIP") - Number(a.icon === "VIP"))
}
