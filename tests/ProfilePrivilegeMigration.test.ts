import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260901081619_protect_profile_verification_flag.sql",
  ),
  "utf8",
)

describe("profile privilege hardening migration", () => {
  it("prevents profile owners from self-assigning seller verification", () => {
    expect(migration).toContain("new.is_seller_verified := false")
    expect(migration).toContain(
      "new.is_seller_verified := old.is_seller_verified",
    )
    expect(migration).toContain("auth.uid() = new.id")
  })

  it("keeps existing admin and suspension protections in the replacement trigger", () => {
    expect(migration).toContain("new.is_admin := false")
    expect(migration).toContain("new.is_admin := old.is_admin")
    expect(migration).toContain("new.is_suspended := false")
    expect(migration).toContain("new.is_suspended := old.is_suspended")
  })

  it("does not expose the trigger function as a callable API", () => {
    expect(migration).toContain(
      "revoke execute on function public.protect_profile_privileged_fields()",
    )
    expect(migration).toContain("from public, anon, authenticated")
  })
})
