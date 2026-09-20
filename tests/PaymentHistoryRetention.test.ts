import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

describe("paid listing history retention", () => {
  const migration = read("supabase/migrations/20260920214247_protect_listing_payment_history.sql")
  const actions = read("app/dashboard/listings/actions.ts")
  const page = read("app/dashboard/listings/page.tsx")

  it("blocks hard deletion in the database when boost/payment history exists", () => {
    expect(migration).toContain("prevent_listing_delete_with_payment_history")
    expect(migration).toContain("from public.listing_boost_orders")
    expect(migration).toContain("listing_has_payment_history")
    expect(migration).toContain("before delete on public.listings")
  })

  it("stops seller deletion before storage cleanup and explains the archive alternative", () => {
    expect(actions).toContain('.from("listing_boost_orders")')
    expect(actions).toContain('redirect(buildRedirect(filter, "payment_history"))')
    expect(page).toContain("VIP/გადახდის ისტორია")
    expect(page).toContain("არქივში")
  })
})
