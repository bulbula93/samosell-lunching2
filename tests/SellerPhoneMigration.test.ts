import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const requiredPhoneMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260829121758_require_seller_phone_for_active_listings.sql",
  ),
  "utf8",
)

const optionalProfilePhoneMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260830161500_allow_profile_phone_removal.sql",
  ),
  "utf8",
)

describe("seller phone migrations", () => {
  it("allows a profile to have no phone while still validating any provided phone", () => {
    expect(requiredPhoneMigration).toContain("profiles_store_phone_format_check")
    expect(requiredPhoneMigration).toContain("store_phone is null")
    expect(requiredPhoneMigration).toContain("between 7 and 15")
  })

  it("blocks publishing or activating a listing without a real profile phone", () => {
    expect(requiredPhoneMigration).toContain("enforce_active_listing_seller_phone")
    expect(requiredPhoneMigration).toContain("new.status = 'active'")
    expect(requiredPhoneMigration).toContain("seller_phone_required")
    expect(requiredPhoneMigration).toContain("before insert or update of seller_id, status")
  })

  it("allows clearing the profile phone even when active listings already exist", () => {
    expect(optionalProfilePhoneMigration).toContain(
      "drop trigger if exists protect_active_listing_seller_phone on public.profiles",
    )
    expect(optionalProfilePhoneMigration).toContain(
      "drop function if exists public.protect_active_listing_seller_phone()",
    )
  })

  it("keeps the publication guard hardened and non-callable by clients", () => {
    expect(requiredPhoneMigration).toContain("security definer")
    expect(requiredPhoneMigration).toContain("set search_path = ''")
    expect(requiredPhoneMigration).toContain("from public, anon, authenticated")
  })
})
