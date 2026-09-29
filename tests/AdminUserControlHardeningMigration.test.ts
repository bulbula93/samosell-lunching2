import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260929091500_harden_admin_user_controls.sql",
  ),
  "utf8",
)

describe("admin user control hardening migration", () => {
  it("blocks self verification mutations", () => {
    expect(migration).toContain("cannot_change_self_verification")
    expect(migration).toContain("if p_user_id = v_actor_id then")
  })

  it("records each listing archived by a user suspension", () => {
    expect(migration).toContain("'listing.hide'")
    expect(migration).toContain("'source', 'user.suspend'")
    expect(migration).toContain("'previous_status', l.status")
    expect(migration).toContain("archived_listings_count")
  })

  it("keeps the RPC unavailable to anonymous clients", () => {
    expect(migration).toContain(
      "revoke all on function public.admin_manage_user(uuid, text, text)",
    )
    expect(migration).toContain(
      "grant execute on function public.admin_manage_user(uuid, text, text)",
    )
  })
})
