import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { applyCatalogFilters, resolveCatalogState } from "@/lib/catalog-page"
import { compactReadOnlyRpcArgs } from "@/lib/search/read-only-rpc-args"
import { shouldCollapseEmptyCatalogPlacements, type AdRecord } from "@/lib/ads"

const catalog = readFileSync("app/catalog/catalog-view.tsx","utf8")
const sql = readFileSync("supabase/migrations/20261012173000_discovery_jacket_synonym.sql","utf8")
const ranked = readFileSync("supabase/migrations/20260831003836_integrate_search_rescue_into_ranked_rpc.sql","utf8")
const filter = readFileSync("components/listings/CatalogLandingFilters.tsx","utf8")
const drawer = readFileSync("components/listings/MobileFiltersDrawer.tsx","utf8")
const defaults = {q:"",category:"",item_type:"",brand:"",size:"",color:"",city:"",condition:"",gender:"",vip:"",sale_type:"",min_price:"",max_price:"",recent:""}

function queryCalls(filters:Record<string,string>) {
  const events:Array<[string,string,unknown]> = []
  const q = {
    eq(column:string,value:string|boolean) {events.push(["eq",column,value]);return this},
    gte(column:string,value:number|string) {events.push(["gte",column,value]);return this},
    lte(column:string,value:number) {events.push(["lte",column,value]);return this},
    or(value:string) {events.push(["or","",value]);return this},
  }
  applyCatalogFilters(q,filters)
  return events
}

describe("Discovery phase 3: search and fresh supply",()=> {
  it("adds a verified Georgian jacket synonym idempotently, without modifying VIP weights",()=> {
    expect(sql).toContain("('ქურთუკი','ჯაკეტი','synonym')")
    expect(sql).toContain("on conflict (alias_normalized) do nothing")
    expect(sql).not.toContain("search_ranking_config")
  })

  it("delegates primary then rescue to one database RPC without redundant client fallback",()=> {
    expect(ranked).toContain("public.search_catalog_ranked_primary")
    expect(ranked).toContain("public.search_catalog_rescue")
    expect(catalog).toContain('supabase.rpc("search_catalog_ranked"')
    expect(catalog).not.toContain('supabase.rpc("search_catalog_rescue"')
  })

  it("allows read-only ranking on a production-linked preview without writing analytics",()=> {
    expect(catalog).toContain('get: isReadOnlyPreview()')
    expect(catalog).toContain('analyticsAllowed && !isReadOnlyPreview()')
    const previewFetch = readFileSync("lib/preview-read-only.ts", "utf8")
    expect(previewFetch).toContain('if (isReadOnlyPreview() && !["GET", "HEAD", "OPTIONS"].includes(method))')
    const proxy = readFileSync("proxy.ts","utf8")
    expect(proxy).toContain('return NextResponse.json({ error: "preview_read_only" }, { status: 403 })')
  })

  it("avoids PostgREST 22P02: strips GET RPC nulls while keeping meaningful arguments",()=> {
    const args = {
      p_query:"Prada",p_category_slug:null,p_item_keywords:[],
      p_vip:null,p_min_price:null,p_max_price:null,
      p_offset:0,p_limit:24,p_ranking_version:null,p_false:false,
    }
    expect(compactReadOnlyRpcArgs(args)).toEqual({
      p_query:"Prada",p_item_keywords:[],p_offset:0,p_limit:24,p_false:false,
    })
    expect(catalog).toContain("compactReadOnlyRpcArgs(rankedArgs)")
    // Optional omitted args use the SQL function's defaults, never literal "null".
    expect(catalog).toContain("get: isReadOnlyPreview()")
  })

  it("shows only one catalog advert invitation when both slots are vacant, but never collapses paid slots",()=> {
    const keys = ["catalog_top_left","catalog_top_right"] as const
    expect(shouldCollapseEmptyCatalogPlacements(keys,{})).toBe(true)
    expect(shouldCollapseEmptyCatalogPlacements(keys,{},true)).toBe(true)
    const ad = {id:"paid"} as AdRecord
    expect(shouldCollapseEmptyCatalogPlacements(keys,{catalog_top_left:ad})).toBe(false)
    expect(shouldCollapseEmptyCatalogPlacements(keys,{catalog_top_left:ad,catalog_top_right:ad})).toBe(false)
    expect(shouldCollapseEmptyCatalogPlacements(["home_hero_left","home_hero_right"],{})).toBe(false)
  })

  it("filters browse results to the last seven days but never overrides a relevance search",()=> {
    const browse=resolveCatalogState({category:"women",recent:"7"})
    expect(browse.filters.recent).toBe("7")
    expect(browse.sort).toBe("latest")
    expect(browse.currentPath).toContain("recent=7")
    const calls=queryCalls(browse.filters)
    const recent=calls.find(x=>x[0]==="gte"&&x[1]==="published_at")
    expect(recent).toBeTruthy()
    expect(Date.parse(String(recent?.[2]))).toBeGreaterThan(Date.now()-8*86400_000)
    const search=resolveCatalogState({q:"Zara",recent:"7"})
    expect(search.sort).toBe("relevance")
    expect(search.filters.recent).toBe("")
    expect(queryCalls(search.filters).some(x=>x[1]==="published_at")).toBe(false)
  })

  it("preserves browse promotion tiers ahead of freshness and in recommendations",()=> {
    expect(catalog).toContain('.order("promotion_tier", { ascending: false }).order("featured_slot"')
    expect(catalog).toContain('.order("promotion_tier", { ascending: false })')
    expect(catalog).toContain(".order(\"published_at\", { ascending: false")
    const vip=queryCalls({...defaults,recent:"7",vip:"1"})
    expect(vip).toContainEqual(["eq","is_vip",true])
    expect(vip.some(x=>x[1]==="published_at")).toBe(true)
  })

  it("does not mislabel unrelated suggested items as matched search results",()=> {
    expect(catalog).toContain("totalCount === 0 && page === 1")
    expect(catalog).toContain("suggestedListings")
    expect(catalog).toContain("არ არის ამ ძიების შედეგები")
    expect(catalog).toContain("searchId={searchId}")
    expect(catalog).toContain('if (sale_type) suggestedQuery = suggestedQuery.eq("sale_type", sale_type)')
    expect(catalog).not.toContain("totalCount = suggestedListings.length")
  })

  it("keeps new filter selections on desktop/mobile and pagination",()=> {
    expect(filter).toContain('name="recent" value="7"')
    expect(drawer).toContain('name="recent" value="7"')
    expect(filter).toContain('key: "recent", label: "ბოლო 7 დღე"')
    const state=resolveCatalogState({category:"men",recent:"7",sort:"popular",page:"2"})
    expect(state.currentPath).toContain("recent=7")
    expect(state.currentPath).toContain("page=2")
    expect(state.currentPath).toContain("sort=popular")
  })
})
