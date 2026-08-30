import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const migration = read("supabase/migrations/20260830230837_complete_sold_buyer_review_flow.sql")
const listingActions = read("app/dashboard/listings/actions.ts")
const reviewActions = read("app/reviews/actions.ts")
const reviewsLib = read("lib/reviews.ts")
const notificationsPage = read("app/dashboard/notifications/page.tsx")

describe("sold -> buyer -> review lifecycle", () => {
  it("requires a selected buyer when a listing is marked sold", () => {
    expect(listingActions).toContain('nextStatus === "sold"')
    expect(listingActions).toContain("validateSelectedBuyer")
    expect(listingActions).toContain("sold_to_user_id")
  })

  it("creates an idempotent review request for the selected buyer", () => {
    expect(migration).toContain("sync_listing_review_request_notification")
    expect(migration).toContain("review_request:%s:%s")
    expect(migration).toContain("'review_request'")
    expect(migration).toContain("on conflict (event_key)")
  })

  it("closes stale review requests when the sold state or buyer changes", () => {
    expect(migration).toContain("review_request_canceled")
    expect(migration).toContain("'status', 'canceled'")
  })

  it("marks the buyer request complete and notifies the seller after a review", () => {
    expect(migration).toContain("sync_review_completion_notifications")
    expect(migration).toContain("'review_completed'")
    expect(migration).toContain("'review_received'")
    expect(migration).toContain("review_received:%s")
  })

  it("keeps seller reputation live from review aggregates and revalidates seller pages", () => {
    expect(reviewsLib).toContain('.from("seller_review_summaries")')
    expect(reviewActions).toContain('revalidatePath("/seller/[username]", "page")')
  })

  it("shows completed and received review notifications with review-specific UI", () => {
    expect(notificationsPage).toContain('type === "review_completed"')
    expect(notificationsPage).toContain('type === "review_received"')
    expect(notificationsPage).toContain('return "დასრულებულია"')
  })
})
