import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260901082327_protect_listing_owner_integrity.sql",
  ),
  "utf8",
)

describe("listing owner integrity migration", () => {
  it("preserves server-derived counters for direct owner updates", () => {
    expect(migration).toContain("new.views_count := old.views_count")
    expect(migration).toContain("new.favorites_count := old.favorites_count")
    expect(migration).toContain("new.views_count := 0")
    expect(migration).toContain("new.favorites_count := 0")
  })

  it("enforces the supported owner status graph", () => {
    expect(migration).toContain("new.status not in ('draft', 'active')")
    expect(migration).toContain(
      "old.status = 'active' and new.status in ('draft', 'reserved', 'sold', 'archived')",
    )
    expect(migration).toContain(
      "old.status = 'archived' and new.status = 'draft'",
    )
    expect(migration).toContain("Invalid listing status transition")
  })

  it("enforces shared listing validation at the database boundary", () => {
    expect(migration).toContain("listings_title_length_guard")
    expect(migration).toContain("listings_description_length_guard")
    expect(migration).toContain("price between 0.01 and 99999999.99")
    expect(migration).toContain("currency = 'GEL'")
    expect(migration).not.toContain(
      "validate constraint listings_description_length_guard",
    )
  })

  it("keeps the guard inaccessible as a direct RPC", () => {
    expect(migration).toContain(
      "revoke all on function private.protect_listing_owner_integrity()",
    )
    expect(migration).toContain("from public, anon, authenticated")
  })
})
