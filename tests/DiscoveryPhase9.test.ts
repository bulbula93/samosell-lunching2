import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  getCatalogDatabaseFilters,
  resolveCatalogState,
} from "@/lib/catalog-page"
import {
  rankSimilarListings,
  similarListingScore,
} from "@/lib/discovery"
import type { CatalogListing } from "@/types/marketplace"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

function listing(
  id: string,
  overrides: Partial<CatalogListing> = {},
): CatalogListing {
  return {
    id,
    seller_id: `seller-${id}`,
    slug: `listing-${id}`,
    title: `ნივთი ${id}`,
    description: null,
    price: 100,
    currency: "GEL",
    condition: "good",
    gender: "men",
    city: "თბილისი",
    material: null,
    color: null,
    is_vip: false,
    promotion_tier: 0,
    brand_name: null,
    size_label: "M",
    category_name: "კაცის ტანსაცმელი",
    category_slug: "men",
    seller_username: null,
    seller_full_name: null,
    seller_is_verified: false,
    cover_image_url: null,
    favorites_count: 0,
    views_count: 0,
    status: "active",
    ...overrides,
  }
}

const catalogPage = read("app/catalog/page.tsx")
const rankingMigration = read(
  "supabase/migrations/20260830234103_add_discovery_search_ranking.sql",
)

describe("phase 9 discovery ranking", () => {
  it("defaults text searches to relevance while keeping browse pages on latest", () => {
    expect(resolveCatalogState({ q: "Prada" }).sort).toBe("relevance")
    expect(resolveCatalogState({}).sort).toBe("latest")
    expect(resolveCatalogState({ q: "Prada", sort: "price_asc" }).sort).toBe(
      "price_asc",
    )
    expect(resolveCatalogState({ sort: "relevance" }).sort).toBe("latest")
  })

  it("keeps free-text query and item taxonomy as separate ranking/filter signals", () => {
    const filters = getCatalogDatabaseFilters({
      q: "Prada",
      category: "men",
      item_type: "jeans",
      brand: "",
      size: "",
      color: "",
      city: "",
      condition: "",
      gender: "",
      vip: "",
      min_price: "",
      max_price: "",
    })

    expect(filters.query).toBe("Prada")
    expect(filters.gender).toBe("men")
    expect(filters.itemKeywords).toContain("ჯინსი")
    expect(filters.itemKeywords).toContain("jeans")
  })

  it("scores product identity above freshness or promotion alone", () => {
    const seed = listing("seed", {
      title: "Prada შავი პიჯაკი",
      brand_name: "Prada",
      size_label: "M",
      color: "შავი",
      price: 300,
    })
    const relevant = listing("relevant", {
      title: "Prada პიჯაკი",
      brand_name: "Prada",
      size_label: "M",
      color: "შავი",
      price: 320,
    })
    const boostedButDifferent = listing("boosted", {
      title: "სპორტული მაისური",
      brand_name: "Nike",
      size_label: "XL",
      color: "თეთრი",
      price: 50,
      promotion_tier: 3,
      favorites_count: 50,
      views_count: 500,
    })

    expect(similarListingScore(seed, relevant)).toBeGreaterThan(
      similarListingScore(seed, boostedButDifferent),
    )
  })

  it("diversifies the first similar-items set across sellers", () => {
    const seed = listing("seed", { title: "Prada პიჯაკი", brand_name: "Prada" })
    const candidates = [
      listing("a1", { seller_id: "seller-a", title: "Prada პიჯაკი 1", brand_name: "Prada" }),
      listing("a2", { seller_id: "seller-a", title: "Prada პიჯაკი 2", brand_name: "Prada" }),
      listing("a3", { seller_id: "seller-a", title: "Prada პიჯაკი 3", brand_name: "Prada" }),
      listing("b1", { seller_id: "seller-b", title: "პიჯაკი B" }),
      listing("c1", { seller_id: "seller-c", title: "პიჯაკი C" }),
    ]

    const ranked = rankSimilarListings(seed, candidates, 4)
    expect(ranked.filter((item) => item.seller_id === "seller-a")).toHaveLength(2)
    expect(new Set(ranked.map((item) => item.seller_id)).size).toBeGreaterThan(1)
  })

  it("uses the database ranking RPC with typo-aware trigram similarity", () => {
    expect(catalogPage).toContain('supabase.rpc("search_catalog_ranked"')
    expect(rankingMigration).toContain("create extension if not exists pg_trgm")
    expect(rankingMigration).toContain("extensions.word_similarity")
    expect(rankingMigration).toContain("promotion_tier, 0) * 1.25")
  })
})
