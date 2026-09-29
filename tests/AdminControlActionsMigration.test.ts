import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260929090000_add_admin_control_actions.sql",
  ),
  "utf8",
)

describe("admin control actions migration", () => {
  it("creates a dedicated admin audit log with admin-only reads", () => {
    expect(migration).toContain("create table if not exists public.admin_audit_log")
    expect(migration).toContain("alter table public.admin_audit_log enable row level security")
    expect(migration).toContain("admins can read admin audit log")
    expect(migration).toContain("revoke all on table public.admin_audit_log from public, anon, authenticated")
  })

  it("keeps listing mutations atomic with their audit entry", () => {
    expect(migration).toContain("public.admin_manage_listing")
    expect(migration).toContain("for update")
    expect(migration).toContain("'listing.hide'")
    expect(migration).toContain("'listing.restore'")
    expect(migration).toContain("insert into public.admin_audit_log")
  })

  it("protects privileged user operations", () => {
    expect(migration).toContain("public.admin_manage_user")
    expect(migration).toContain("cannot_suspend_self")
    expect(migration).toContain("cannot_suspend_admin")
    expect(migration).toContain("'seller.verify'")
    expect(migration).toContain("'seller.unverify'")
  })

  it("exposes only the narrow RPC surface to authenticated sessions", () => {
    expect(migration).toContain(
      "grant execute on function public.admin_manage_listing(uuid, text, text)",
    )
    expect(migration).toContain(
      "grant execute on function public.admin_manage_user(uuid, text, text)",
    )
  })
})
