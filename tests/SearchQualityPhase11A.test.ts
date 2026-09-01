import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const migration = read(
  "supabase/migrations/20260831003206_add_search_quality_phase_11a.sql",
)
const hardening = read(
  "supabase/migrations/20260831003555_harden_search_experiment_attribution.sql",
)
const dictionary = read(
  "supabase/migrations/20260831055614_expand_search_quality_dictionary_phase_11a1.sql",
)
const thresholdHardening = read(
  "supabase/migrations/20260831055832_tighten_search_rescue_fuzzy_threshold_phase_11a1.sql",
)
const compoundRescue = read(
  "supabase/migrations/20260831060050_improve_compound_search_rescue_phase_11a1.sql",
)
const catalogPage = read("app/catalog/page.tsx")
const adminPage = read("app/admin/search/page.tsx")
const adminActions = read("app/admin/search/actions.ts")

describe("phase 11A search quality infrastructure", () => {
  it("keeps rescue separate from the primary ranked search", () => {
    expect(migration).toContain("public.search_catalog_ranked")
    expect(migration).toContain("public.search_catalog_rescue")
    expect(catalogPage).toContain('supabase.rpc("search_catalog_ranked"')
    expect(catalogPage).toContain('"search_catalog_rescue"')
    expect(catalogPage).toContain("total_count ?? 0)) === 0")
  })

  it("supports aliases and Latin to Georgian transliteration", () => {
    expect(migration).toContain("public.search_query_aliases")
    expect(migration).toContain("public.search_latin_to_georgian")
    expect(migration).toContain("public.get_search_query_expansions")
    expect(dictionary).toContain("('ჯინსები', 'jinsebi', 'transliteration')")
    expect(migration).toContain("'hoodie'")
  })

  it("covers high-confidence fashion vocabulary without broad ambiguous rewrites", () => {
    expect(dictionary).toContain("('მაისური', 't-shirt', 'synonym')")
    expect(dictionary).toContain("('ქვედაბოლო', 'skirt', 'synonym')")
    expect(dictionary).toContain("('შარვალი', 'pants', 'synonym')")
    expect(dictionary).toContain("('ჩექმა', 'boots', 'synonym')")
    expect(dictionary).toContain("('მაღალქუსლიანი', 'high heels', 'synonym')")
    expect(dictionary).toContain("('Balenciaga', 'ბალენსიაგა', 'brand')")
    expect(dictionary).not.toContain("'body'")
    expect(dictionary).not.toContain("'sweatshirt'")
  })

  it("keeps typo rescue conservative enough to avoid obvious false positives", () => {
    expect(thresholdHardening).toContain("greatest(0.38")
    expect(thresholdHardening).toContain("fuzzy_threshold")
    expect(thresholdHardening).not.toContain("greatest(0.28")
  })

  it("normalizes compound queries token by token and requires all meaningful tokens", () => {
    expect(compoundRescue).toContain("public.search_normalize_query_tokens")
    expect(compoundRescue).toContain("'normalized'::text as source")
    expect(compoundRescue).toContain("regexp_split_to_table(btrim(t.term), '\\s+')")
    expect(compoundRescue).toContain("when position(' ' in btrim(t.term)) > 0 then not exists")
    expect(compoundRescue).toContain("('ჩანთა', 'chanta', 'transliteration')")
    expect(compoundRescue).toContain("('სათვალე', 'satvale', 'transliteration')")
  })

  it("does not expose alias management tables directly to marketplace clients", () => {
    expect(migration).toContain("revoke all on table public.search_query_aliases from anon, authenticated")
    expect(migration).toContain("public.admin_upsert_search_alias")
    expect(migration).toContain("public.admin_delete_search_alias")
    expect(migration).toContain("admin_required")
    expect(compoundRescue).toContain("revoke all on function public.search_normalize_query_tokens(text) from public")
  })

  it("shows users when a zero-result query was rescued", () => {
    expect(catalogPage).toContain("ძებნა გავაფართოვეთ")
    expect(catalogPage).toContain("rescue_mode")
    expect(catalogPage).toContain("resolved_query")
  })

  it("provides admin-managed alias controls", () => {
    expect(adminPage).toContain("Search aliases")
    expect(adminPage).toContain("upsertSearchAliasAction")
    expect(adminActions).toContain('admin.rpc("admin_upsert_search_alias_service"')
    expect(adminActions).toContain('admin.rpc("admin_delete_search_alias_service"')
    expect(adminActions).toContain("p_actor_id: user.id")
  })

  it("prepares A/B assignment without activating an experiment automatically", () => {
    expect(migration).toContain("public.search_ranking_experiments")
    expect(migration).toContain("status text not null default 'draft'")
    expect(migration).toContain("public.get_search_experiment_assignment")
    expect(migration).not.toContain("insert into public.search_ranking_experiments")
    expect(adminPage).toContain("NO ACTIVE EXPERIMENT")
  })

  it("stores experiment variants only when an experiment id exists", () => {
    expect(hardening).toContain("if v_experiment_id is not null then")
    expect(hardening).toContain("v_experiment_variant := nullif")
  })
})
