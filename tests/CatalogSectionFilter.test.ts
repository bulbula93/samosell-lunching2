import { describe, expect, it } from "vitest"
import { applyCatalogFilters, getCatalogDatabaseFilters } from "@/lib/catalog-page"

function recorder() {
  const calls: Array<[string, ...unknown[]]> = []
  const q: Record<string, (...a: unknown[]) => unknown> = {}
  for (const m of ["or", "eq", "gte", "lte", "ilike", "in"]) q[m] = (...a: unknown[]) => { calls.push([m, ...a]); return q }
  return { q, calls }
}

describe("section pages (women / men / kids)", () => {
  it.each(["women", "men", "kids"])("/catalog/%s matches gender OR section category", (section) => {
    const filters = { category: section }
    const db = getCatalogDatabaseFilters(filters)
    expect(db).toMatchObject({ section, gender: "" })
    const { q, calls } = recorder()
    applyCatalogFilters(q as never, filters)
    expect(calls).toContainEqual(["or", `gender.eq.${section},category_slug.eq.${section}`])
    expect(calls.some(c => c[0] === "eq" && c[1] === "gender")).toBe(false)
  })

  it("an explicit gender filter without a section still filters by gender only", () => {
    const filters = { category: "footwear", gender: "kids" }
    const db = getCatalogDatabaseFilters(filters)
    expect(db.section).toBe("")
    const { q, calls } = recorder()
    applyCatalogFilters(q as never, filters)
    expect(calls).toContainEqual(["eq", "gender", "kids"])
  })
})
