import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const notifications = read("lib/notifications.ts")
const favoriteAction = read("app/favorites/actions.ts")
const reminders = read("lib/notification-reminders.ts")
const reminderRoute = read("app/api/internal/notifications/reconcile/route.ts")
const schedule = read("supabase/migrations/20261003134500_schedule_useful_notifications.sql")
const page = read("app/dashboard/notifications/page.tsx")

describe("useful marketplace notifications", () => {
  it("uses contextual copy for the first buyer message", () => {
    expect(notifications).toContain('"შენს ნივთზე მოგწერეს"')
  })

  it("notifies a seller at most once per listing per day for favorites", () => {
    expect(favoriteAction).toContain("notifyListingFavorited")
    expect(notifications).toContain("listing_favorited:")
    expect(notifications).toContain("daily_per_listing")
    expect(notifications).toContain('error.code !== "23505"')
  })

  it("deduplicates VIP expiry and stale listing reminders", () => {
    expect(reminders).toContain("vip_expiry:")
    expect(reminders).toContain("listing_stale:")
    expect(reminders).toContain("ignoreDuplicates: true")
    expect(reminders).toContain("48 * 60 * 60 * 1000")
    expect(reminders).toContain("7 * 24 * 60 * 60 * 1000")
  })

  it("keeps reminder reconciliation protected and scheduled daily", () => {
    expect(reminderRoute).toContain("process.env.CRON_SECRET")
    expect(reminderRoute).toContain('"verify_tbc_recovery_token"')
    expect(schedule).toContain("'15 8 * * *'")
    expect(schedule).toContain("/api/internal/notifications/reconcile")
  })

  it("shows dedicated icons for the new notification types", () => {
    expect(page).toContain('type === "listing_favorited"')
    expect(page).toContain('type === "listing_stale"')
    expect(page).toContain('type === "boost_expiry"')
  })
})
