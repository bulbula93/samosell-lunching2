import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const migration = read(
  "supabase/migrations/20260830231800_add_favorite_price_drop_notifications.sql",
)
const notificationPage = read("app/dashboard/notifications/page.tsx")
const favoritesPage = read("app/dashboard/favorites/page.tsx")

describe("favorite price drop notifications", () => {
  it("only triggers when the listing price decreases", () => {
    expect(migration).toContain("after update of price")
    expect(migration).toContain("when (new.price < old.price)")
    expect(migration).toContain("new.status <> 'active'")
  })

  it("notifies current favorite owners without notifying the seller", () => {
    expect(migration).toContain("from public.favorites favorite")
    expect(migration).toContain("favorite.listing_id = new.id")
    expect(migration).toContain("favorite.user_id <> new.seller_id")
    expect(migration).toContain("not favorite_owner.is_suspended")
  })

  it("respects user blocks and prevents duplicate event rows", () => {
    expect(migration).toContain("from public.user_blocks block_row")
    expect(migration).toContain("price_drop:%s:%s:%s:%s:%s")
    expect(migration).toContain("on conflict (event_key) do nothing")
  })

  it("uses the existing notification center UI", () => {
    expect(notificationPage).toContain('type === "price_drop"')
    expect(notificationPage).toContain('return "₾"')
    expect(favoritesPage).toContain("ფასი")
    expect(favoritesPage).toContain("შეტყობინებას ავტომატურად მიიღებ")
  })
})
