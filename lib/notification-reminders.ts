import { createAdminClient } from "@/lib/supabase/admin"

type ListingReminderRow = {
  id: string
  seller_id: string
  title: string
  slug: string
  updated_at: string
  vip_until: string | null
}

function compact(value: string, max = 90) {
  const text = value.replace(/\s+/g, " ").trim()
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

export async function reconcileUsefulListingNotifications() {
  const admin = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const vipWindowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
  const staleCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: expiringVip, error: vipError }, { data: staleListings, error: staleError }] =
    await Promise.all([
      admin
        .from("listings")
        .select("id, seller_id, title, slug, updated_at, vip_until")
        .eq("status", "active")
        .eq("is_vip", true)
        .not("vip_until", "is", null)
        .gt("vip_until", nowIso)
        .lte("vip_until", vipWindowEnd)
        .limit(250),
      admin
        .from("listings")
        .select("id, seller_id, title, slug, updated_at, vip_until")
        .eq("status", "active")
        .lte("updated_at", staleCutoff)
        .limit(250),
    ])

  if (vipError) throw new Error(`VIP_REMINDER_QUERY_FAILED:${vipError.message}`)
  if (staleError) throw new Error(`STALE_LISTING_QUERY_FAILED:${staleError.message}`)

  const vipRows = ((expiringVip ?? []) as ListingReminderRow[]).map((listing) => {
    const expiryKey = listing.vip_until ?? "unknown"
    return {
      user_id: listing.seller_id,
      type: "boost_expiry",
      title: "VIP მალე იწურება",
      body: `„${compact(listing.title)}“-ის VIP სტატუსი 48 საათში იწურება.`,
      href: `/dashboard/listings/${listing.id}/promote`,
      listing_id: listing.id,
      event_key: `vip_expiry:${listing.id}:${expiryKey}`,
      metadata: { window_hours: 48, vip_until: listing.vip_until },
    }
  })

  const staleRows = ((staleListings ?? []) as ListingReminderRow[]).map((listing) => ({
    user_id: listing.seller_id,
    type: "listing_stale",
    title: "განცხადება 7 დღეა არ განახლებულა",
    body: `„${compact(listing.title)}“ დიდი ხანია არ განახლებულა — გადაამოწმე ფასი, ფოტოები ან აღწერა.`,
    href: `/dashboard/listings/${listing.id}/edit`,
    listing_id: listing.id,
    event_key: `listing_stale:${listing.id}:${listing.updated_at.slice(0, 10)}`,
    metadata: { stale_days: 7, last_updated_at: listing.updated_at },
  }))

  let insertedVip = 0
  let insertedStale = 0

  if (vipRows.length > 0) {
    const { data, error } = await admin
      .from("notifications")
      .upsert(vipRows, { onConflict: "event_key", ignoreDuplicates: true })
      .select("id")
    if (error) throw new Error(`VIP_REMINDER_INSERT_FAILED:${error.message}`)
    insertedVip = data?.length ?? 0
  }

  if (staleRows.length > 0) {
    const { data, error } = await admin
      .from("notifications")
      .upsert(staleRows, { onConflict: "event_key", ignoreDuplicates: true })
      .select("id")
    if (error) throw new Error(`STALE_REMINDER_INSERT_FAILED:${error.message}`)
    insertedStale = data?.length ?? 0
  }

  return {
    scannedVip: vipRows.length,
    scannedStale: staleRows.length,
    insertedVip,
    insertedStale,
  }
}
