import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const storePage = readFileSync(
  join(process.cwd(), "app", "admin", "stores", "page.tsx"),
  "utf8",
)

const adminActions = readFileSync(
  join(process.cwd(), "app", "admin", "actions.ts"),
  "utf8",
)

const adminPage = readFileSync(
  join(process.cwd(), "app", "admin", "page.tsx"),
  "utf8",
)

describe("admin stores management", () => {
  it("loads only store seller profiles", () => {
    expect(storePage).toContain('.eq("seller_type", "store")')
    expect(storePage).toContain("store_phone")
    expect(storePage).toContain("store_address")
    expect(storePage).toContain("store_website")
  })

  it("reuses audited user controls instead of writing profiles directly", () => {
    expect(storePage).toContain("adminUserAction")
    expect(storePage).toContain('name="nextPath" value="/admin/stores"')
    expect(storePage).not.toContain('.from("profiles").update(')
  })

  it("keeps action redirects on a strict admin allowlist", () => {
    expect(adminActions).toContain(
      'return requested === "/admin/stores" ? "/admin/stores" : "/admin/users"',
    )
    expect(adminActions).not.toContain("redirect(nextPath)")
  })

  it("revalidates the store view after user controls", () => {
    expect(adminActions).toContain('revalidatePath("/admin/stores")')
  })

  it("links stores from the main admin dashboard", () => {
    expect(adminPage).toContain('href="/admin/stores"')
    expect(adminPage).toContain("მაღაზიები")
  })
})
