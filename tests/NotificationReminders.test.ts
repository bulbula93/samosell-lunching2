import { describe, expect, it } from "vitest"
import { buildSellerReminders, type ReminderListing } from "@/lib/notification-reminders"
const now = Date.parse("2026-10-03T12:00:00Z")
const listing: ReminderListing = { id: "a", seller_id: "seller-a", slug: "item", title: "ნივთი", status: "active", updated_at: "2026-09-25T12:00:00Z", vip_until: null, favorites_count: 3 }
describe("owner-scoped useful reminders", () => {
  it("uses real aggregate favorite counts and one stale reminder per listing", () => {
    const result = buildSellerReminders([listing], "seller-a", now)
    expect(result.map(x => x.id)).toEqual(["stale:a", "favorite:a"])
    expect(result[1].body).toContain("3 მომხმარებელს")
  })
  it("never returns another seller's, inactive or deleted listings", () => {
    expect(buildSellerReminders([listing, {...listing, seller_id:"seller-b", status:"deleted"}], "seller-b", now)).toEqual([])
    expect(buildSellerReminders([{...listing,status:"archived"}], "seller-a", now)).toEqual([])
  })
  it("prioritizes a real unexpired VIP ending within 24 hours over stale advice", () => {
    const result = buildSellerReminders([{...listing,vip_until:"2026-10-04T11:00:00Z"}],"seller-a",now)
    expect(result[0].title).toBe("VIP იწურება")
    expect(result.some(x=>x.id.startsWith("stale:"))).toBe(false)
    expect(buildSellerReminders([{...listing,updated_at:null,favorites_count:0,vip_until:"2026-10-02T12:00:00Z"}],"seller-a",now)).toEqual([])
  })
  it("does not invent events from invalid dates or counts", () => {
    expect(buildSellerReminders([{...listing,updated_at:"bad",vip_until:"bad",favorites_count:null}],"seller-a",now)).toEqual([])
  })
})
