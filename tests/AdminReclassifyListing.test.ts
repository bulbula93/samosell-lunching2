// @vitest-environment node
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireAdmin: vi.fn(), revalidatePath: vi.fn(), invalidate: vi.fn() }))
vi.mock("@/lib/auth", () => ({ requireAdminUser: mocks.requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/public-marketplace-invalidation", () => ({ invalidatePublicMarketplace: mocks.invalidate }))
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) } }))
import { adminReclassifyListingAction } from "@/app/admin/actions"

const ID = "5f0c2a54-3e0b-4d6a-9a41-1b2f3c4d5e6f"
const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
const run = (o: Record<string, string>) => adminReclassifyListingAction(form(o)).catch((e: Error) => decodeURIComponent(e.message.replace(/\+/g, " ")))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireAdmin.mockResolvedValue({ supabase: { rpc: mocks.rpc } })
})

describe("adminReclassifyListingAction", () => {
  it("moves a listing to the kids section via the audited admin RPC and refreshes public pages", async () => {
    mocks.rpc.mockResolvedValue({ data: "updated", error: null })
    const res = await run({ listingId: ID, categoryId: "12", gender: "kids", adminNote: "ბავშვის ქურთუკი" })
    expect(mocks.rpc).toHaveBeenCalledWith("admin_reclassify_listing", { p_listing_id: ID, p_category_id: 12, p_gender: "kids", p_note: "ბავშვის ქურთუკი" })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/catalog")
    expect(mocks.invalidate).toHaveBeenCalled()
    expect(res).toContain("ok=განყოფილება შეიცვალა")
  })

  it.each([
    [{ listingId: "x", categoryId: "12", gender: "kids" }],
    [{ listingId: ID, categoryId: "abc", gender: "kids" }],
    [{ listingId: ID, categoryId: "-1", gender: "kids" }],
    [{ listingId: ID, categoryId: "12", gender: "aliens" }],
  ])("rejects invalid input before authentication or the database: %o", async (input) => {
    const res = await run(input)
    expect(res).toContain("error=")
    expect(mocks.requireAdmin).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("surfaces database authorization errors in Georgian", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "not_authorized" } })
    expect(await run({ listingId: ID, categoryId: "12", gender: "kids" })).toContain("ადმინისტრატორის უფლებაა საჭირო")
  })
})

describe("admin_reclassify_listing migration", () => {
  const sql = readFileSync("supabase/migrations/20261107040000_admin_reclassify_listing.sql", "utf8")
  it("is admin-only, audited, validated and not callable by anon", () => {
    expect(sql).toMatch(/security definer\s+set search_path = ''/)
    expect(sql).toContain("if not public.is_current_user_admin() then")
    expect(sql).toContain("'listing.reclassify', p_listing_id")
    expect(sql).toContain("p_gender not in ('women', 'men', 'unisex', 'kids')")
    expect(sql).toContain("c.is_active")
    expect(sql).toContain("revoke all on function public.admin_reclassify_listing(uuid, bigint, text, text) from public, anon")
    // keeps every existing audit action
    for (const a of ["listing.hide", "listing.restore", "user.suspend", "category.update", "support.reopen"]) expect(sql).toContain(`'${a}'`)
  })
})
