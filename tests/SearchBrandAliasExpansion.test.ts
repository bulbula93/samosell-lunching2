import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  "supabase/migrations/20261124120000_search_primary_brand_alias_expansion.sql",
  "utf8",
)

describe("primary search brand alias expansion", () => {
  it("only replaces the primary search function, keeping its signature and invoker rights", () => {
    expect(migration).toContain("create or replace function public.search_catalog_ranked_primary(p_query text")
    expect(migration).not.toMatch(/security definer/i)
    expect(migration).toContain("SET search_path TO ''")
    expect(migration).not.toContain("search_catalog_rescue")
  })

  it("expands a whole-query brand to every spelling from the brand aliases", () => {
    expect(migration).toContain("a.kind = 'brand'")
    expect(migration).toContain("in (a.alias_normalized, a.canonical_normalized)")
    expect(migration).toContain("a.canonical_normalized = g.canonical")
  })

  it("matches spellings literally (no LIKE wildcards from alias data)", () => {
    expect(migration).toContain("position(b.term in lower(coalesce(lc.title, ''))) > 0")
    expect(migration).not.toMatch(/ilike '%' \|\| b\.term/)
  })

  it("keeps every existing filter", () => {
    for (const filter of [
      "(n.brand is null or lc.brand_name = n.brand)",
      "(n.size_label is null or lc.size_label = n.size_label)",
      "(n.city is null or lc.city = n.city)",
      "(p_max_price is null or lc.price <= p_max_price)",
      "lc.status = 'active'",
    ]) {
      expect(migration).toContain(filter)
    }
  })
})
