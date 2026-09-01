import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  "supabase/migrations/20260901092000_lock_down_listing_view_counter.sql",
  "utf8",
)

describe("listing view counter privileges", () => {
  it("does not expose the ranking counter mutation to browser roles", () => {
    expect(migration).toContain(
      "revoke all on function public.increment_listing_views(uuid) from public, anon, authenticated",
    )
    expect(migration).toContain(
      "grant execute on function public.increment_listing_views(uuid) to service_role",
    )
  })
})
