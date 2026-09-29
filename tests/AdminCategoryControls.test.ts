import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260929093000_add_admin_category_controls.sql",
  ),
  "utf8",
)

const headerSource = readFileSync(
  join(process.cwd(), "components", "layout", "SiteHeader.tsx"),
  "utf8",
)

const newListingSource = readFileSync(
  join(process.cwd(), "app", "dashboard", "listings", "new", "page.tsx"),
  "utf8",
)

const formActionsSource = readFileSync(
  join(process.cwd(), "app", "dashboard", "listings", "form-actions.ts"),
  "utf8",
)

describe("admin category controls", () => {
  it("adds presentation and active-state fields without changing category slugs", () => {
    expect(migration).toContain("add column if not exists navigation_label text")
    expect(migration).toContain("add column if not exists sort_order integer")
    expect(migration).toContain("add column if not exists is_active boolean")
    expect(migration).toContain("public.admin_update_category")
    expect(migration).not.toContain("p_slug")
    expect(migration).not.toMatch(/set\s+slug\s*=/i)
  })

  it("audits category updates through the shared admin audit log", () => {
    expect(migration).toContain("target_category_id")
    expect(migration).toContain("'category.update'")
    expect(migration).toContain("insert into public.admin_audit_log")
  })

  it("keeps the category RPC admin-only", () => {
    expect(migration).toContain("public.is_current_user_admin()")
    expect(migration).toContain(
      "revoke all on function public.admin_update_category(bigint, text, text, integer, boolean, text)",
    )
    expect(migration).toContain(
      "grant execute on function public.admin_update_category(bigint, text, text, integer, boolean, text)",
    )
  })

  it("uses active category settings in navigation and new listing flows", () => {
    expect(headerSource).toContain('.eq("is_active", true)')
    expect(headerSource).toContain("navigation_label")
    expect(headerSource).toContain('.order("sort_order", { ascending: true })')
    expect(newListingSource).toContain('.eq("is_active", true)')
  })

  it("allows an existing listing to retain its now-inactive category while blocking new selection", () => {
    expect(formActionsSource).toContain("allowedInactiveCategoryId")
    expect(formActionsSource).toContain("categoryResult.data.is_active")
    expect(formActionsSource).toContain("ownedListing?.category_id")
  })
})
