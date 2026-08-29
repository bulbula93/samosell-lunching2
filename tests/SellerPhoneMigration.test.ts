import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260829121758_require_seller_phone_for_active_listings.sql",
  ),
  "utf8",
)

describe("required seller phone migration", () => {
  it("validates phone shape without requiring a phone for buyer-only accounts", () => {
    expect(migration).toContain("profiles_store_phone_format_check")
    expect(migration).toContain("store_phone is null")
    expect(migration).toContain("between 7 and 15")
  })

  it("blocks active listings without a real seller phone at database level", () => {
    expect(migration).toContain("enforce_active_listing_seller_phone")
    expect(migration).toContain("new.status = 'active'")
    expect(migration).toContain("seller_phone_required")
    expect(migration).toContain("before insert or update of seller_id, status")
  })

  it("prevents clearing the phone while active listings exist", () => {
    expect(migration).toContain("protect_active_listing_seller_phone")
    expect(migration).toContain("l.status = 'active'")
    expect(migration).toContain("before update of store_phone")
  })

  it("uses hardened trigger functions that clients cannot call", () => {
    expect(migration.match(/security definer/g)).toHaveLength(2)
    expect(migration.match(/set search_path = ''/g)).toHaveLength(2)
    expect(migration).toContain("from public, anon, authenticated")
  })
})
