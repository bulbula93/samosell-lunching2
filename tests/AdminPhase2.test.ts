import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const storesSource = readFileSync(
  join(process.cwd(), "app", "admin", "stores", "page.tsx"),
  "utf8",
)

const reportsSource = readFileSync(
  join(process.cwd(), "app", "admin", "reports", "page.tsx"),
  "utf8",
)

const actionsSource = readFileSync(
  join(process.cwd(), "app", "admin", "actions.ts"),
  "utf8",
)

const adminSource = readFileSync(
  join(process.cwd(), "app", "admin", "page.tsx"),
  "utf8",
)

describe("admin panel phase 2", () => {
  it("adds a dedicated stores workspace without creating a new privileged mutation path", () => {
    expect(storesSource).toContain('eq("seller_type", "store")')
    expect(storesSource).toContain("storeCompleteness")
    expect(storesSource).toContain("adminUserAction")
    expect(storesSource).toContain('name="returnPath" value="/admin/stores"')
    expect(storesSource).not.toContain(".update(")
  })

  it("keeps store actions on the existing audited admin user RPC flow", () => {
    expect(actionsSource).toContain('requestedReturnPath === "/admin/stores"')
    expect(actionsSource).toContain('supabase.rpc("admin_manage_user"')
    expect(actionsSource).toContain('revalidatePath("/admin/stores")')
  })

  it("adds moderation SLA backlog search and sorting controls", () => {
    expect(reportsSource).toContain('type AgeFilter = "all" | "overdue"')
    expect(reportsSource).toContain('type SortMode = "priority" | "newest" | "oldest"')
    expect(reportsSource).toContain("24სთ+ backlog")
    expect(reportsSource).toContain('name="q"')
    expect(reportsSource).toContain('name="age"')
    expect(reportsSource).toContain('name="sort"')
    expect(reportsSource).toContain("overdueCutoffTime")
    expect(reportsSource).toContain('select("seller_id, reason, status, created_at")')
  })

  it("surfaces stores from the admin dashboard", () => {
    expect(adminSource).toContain('href="/admin/stores"')
    expect(adminSource).toContain('.eq("seller_type", "store")')
    expect(adminSource).toContain('label="მაღაზიები"')
  })
})
