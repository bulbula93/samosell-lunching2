import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260902095112_add_public_listing_ids.sql",
  ),
  "utf8",
)

describe("public listing IDs", () => {
  it("derives a stable database-owned code and enforces uniqueness", () => {
    expect(migration).toContain("generated always as")
    expect(migration).toContain("'SS-' || upper")
    expect(migration).toContain("create unique index if not exists listings_public_id_key")
  })

  it("exposes the code through the existing security-invoker catalog view", () => {
    expect(migration).toContain("with (security_invoker = true)")
    expect(migration).toContain("l.public_id")
    expect(migration).toContain("grant select on public.listings_catalog to anon, authenticated")
  })
})
