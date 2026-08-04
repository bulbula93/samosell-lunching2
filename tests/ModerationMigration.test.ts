import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260803230124_secure_trust_safety_foundation.sql",
  ),
  "utf8",
)

describe("secure trust and safety migration", () => {
  it("adds user reports, audit history, RLS, and bounded text", () => {
    expect(migration).toContain("create table if not exists public.user_reports")
    expect(migration).toContain(
      "create table if not exists public.moderation_audit_log",
    )
    expect(migration).toContain(
      "alter table public.user_reports enable row level security",
    )
    expect(migration).toContain("char_length(details) <= 2000")
  })

  it("derives listing seller and report ownership from auth and database state", () => {
    expect(migration).toContain("v_reporter_id uuid := auth.uid()")
    expect(migration).toContain("select l.seller_id")
    expect(migration).toContain("where l.id = p_listing_id")
    expect(migration).not.toContain("p_seller_id")
    expect(migration).not.toContain("p_reporter_id")
  })

  it("revokes broad table writes and exposes only narrow validated RPCs", () => {
    expect(migration).toContain(
      "revoke all on table public.listing_reports from public, anon, authenticated",
    )
    expect(migration).toContain(
      "revoke all on table public.user_blocks from public, anon, authenticated",
    )
    expect(migration).toContain(
      "grant execute on function public.submit_listing_report(uuid, text, text)",
    )
    expect(migration).toContain(
      "grant execute on function public.set_user_blocked(uuid, boolean)",
    )
  })

  it("keeps admin decisions atomic and derives every target from the report", () => {
    expect(migration).toContain("public.review_moderation_report")
    expect(migration).toContain("where r.id = p_report_id")
    expect(migration).toContain("for update")
    expect(migration).toContain(
      "insert into public.moderation_audit_log",
    )
    expect(migration).not.toContain("p_target_user_id")
    expect(migration).not.toContain("p_target_listing_id")
  })

  it("prevents a user from granting themselves admin or clearing suspension", () => {
    expect(migration).toContain("public.protect_profile_privileged_fields")
    expect(migration).toContain("new.is_admin := old.is_admin")
    expect(migration).toContain("new.is_suspended := old.is_suspended")
    expect(migration).toContain("new.is_admin := false")
  })
})
