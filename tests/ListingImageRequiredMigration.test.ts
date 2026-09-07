import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260907224607_require_listing_cover_image.sql",
  ),
  "utf8",
)

describe("required listing image migration", () => {
  it("rejects missing and blank cover image URLs at the database boundary", () => {
    expect(migration).toContain("listings_cover_image_required")
    expect(migration).toContain("nullif(btrim(cover_image_url), '') is not null")
    expect(migration).toContain("validate constraint listings_cover_image_required")
  })
})
