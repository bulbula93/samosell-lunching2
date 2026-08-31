import { randomUUID } from "node:crypto"
import type { Metadata } from "next"
import SiteHeader from "@/components/layout/SiteHeader"
import CatalogLandingFilters from "@/components/listings/CatalogLandingFilters"
import CatalogPagination from "@/components/listings/CatalogPagination"
import CatalogPageHeader from "@/components/listings/CatalogPageHeader"
import CatalogResultsGrid from "@/components/listings/CatalogResultsGrid"
import SavedSearchControls from "@/components/listings/SavedSearchControls"
import {
  PAGE_SIZE,
  applyCatalogFilters,
  getCatalogDatabaseFilters,
  getCatalogPath,
  normalizeText,
  resolveCatalogState,
  type CatalogSearchParams,
  summarizeFilters,
} from "@/lib/catalog-page"
import { CATALOG_SECTION_OPTIONS } from "@/lib/catalog-taxonomy"
import { GEORGIA_CITIES } from "@/lib/marketplace-options"
import {
  buildSavedSearchPath,
  hasSavableCatalogFilters,
} from "@/lib/saved-searches"
import { absoluteUrl, buildCatalogDescription, buildCatalogTitle } from "@/lib/seo"
import { createClient } from "@/lib/supabase/server"
import type { CatalogListing } from "@/types/marketplace"

type CatalogPageParams = CatalogSearchParams & {
  saved_search_status?: string | string[]
}

type RankedSearchPayload = {
  items?: CatalogListing[]
  total_count?: number
}

const CATALOG_LISTING_SELECT =
  "id, seller_id, slug, title, description, price, currency, condition, city, material, color, gender, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, promotion_tier, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, seller_type, seller_avatar_url, seller_store_logo_url, cover_image_url, published_at, favorites_count, views_count, status"

function readStatus(value?: string | string[]) {
  return typeof value === "string" ? value : ""
}

function optionalNumber(value: string) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function generateMetadata({ searchParams }: { searchParams?: Promise<CatalogPageParams> }): Promise<Metadata> {
  const params = (await searchParams) ?? {}
  const { filters, page, queryParams } = resolveCatalogState(params)
  const path = queryParams.toString() ? `/catalog?${queryParams.toString()}` : "/catalog"
  const title = buildCatalogTitle(page)
  const description = buildCatalogDescription(summarizeFilters(filters))

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: absoluteUrl(path), type: "website", images: [{ url: absoluteUrl("/opengraph-image") }] },
    twitter: { card: "summary_large_image", title, description, images: [absoluteUrl("/opengraph-image")] },
  }
}

export default async function CatalogPage({ searchParams }: { searchParams?: Promise<CatalogPageParams> }) {
  const params = (await searchParams) ?? {}
  const { filters, sort, page, queryParams, currentPath } = resolveCatalogState(params)
  const { q, category, item_type, brand, size, color, city, condition, gender, vip, min_price, max_price } = filters
  const filterValues = { q, category, item_type, brand, size, color, city, condition, gender, vip, sort, min_price, max_price }
  const savedSearchPath = buildSavedSearchPath(filters)
  const canSaveSearch = hasSavableCatalogFilters(filters)
  const savedSearchStatus = readStatus(params.saved_search_status)
  const databaseFilters = getCatalogDatabaseFilters(filters)
  const useRankedSearch = Boolean(q && sort === "relevance")

  const rangeFrom = (page - 1) * PAGE_SIZE
  const rangeTo = rangeFrom + PAGE_SIZE - 1

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let listingsQuery = applyCatalogFilters(
    supabase
      .from("listings_catalog")
      .select(CATALOG_LISTING_SELECT)
      .eq("status", "active"),
    filters
  )

  const countQuery = applyCatalogFilters(
    supabase.from("listings_catalog").select("id", { count: "exact", head: true }).eq("status", "active"),
    filters
  )

  switch (sort) {
    case "price_asc":
      listingsQuery = listingsQuery.order("price", { ascending: true }).order("published_at", { ascending: false, nullsFirst: false })
      break
    case "price_desc":
      listingsQuery = listingsQuery.order("price", { ascending: false }).order("published_at", { ascending: false, nullsFirst: false })
      break
    case "vip":
      listingsQuery = listingsQuery.order("promotion_tier", { ascending: false }).order("published_at", { ascending: false, nullsFirst: false })
      break
    case "popular":
      listingsQuery = listingsQuery.order("favorites_count", { ascending: false, nullsFirst: false }).order("views_count", { ascending: false, nullsFirst: false }).order("published_at", { ascending: false, nullsFirst: false })
      break
    default:
      listingsQuery = listingsQuery.order("promotion_tier", { ascending: false }).order("featured_slot", { ascending: true, nullsFirst: false }).order("published_at", { ascending: false, nullsFirst: false })
      break
  }

  const rankedSearchPromise = useRankedSearch
    ? supabase.rpc("search_catalog_ranked", {
        p_query: databaseFilters.query,
        p_category_slug: databaseFilters.categorySlug || null,
        p_item_keywords: databaseFilters.itemKeywords,
        p_brand: brand || null,
        p_size: size || null,
        p_color: color || null,
        p_city: city || null,
        p_condition: condition || null,
        p_gender: databaseFilters.gender || null,
        p_vip: vip === "1" ? true : null,
        p_min_price: optionalNumber(min_price),
        p_max_price: optionalNumber(max_price),
        p_offset: rangeFrom,
        p_limit: PAGE_SIZE,
      })
    : Promise.resolve({ data: null, error: null })

  const listingsPromise = useRankedSearch
    ? Promise.resolve({ data: [] as CatalogListing[], error: null })
    : listingsQuery.range(rangeFrom, rangeTo)
  const countPromise = useRankedSearch
    ? Promise.resolve({ count: 0, error: null })
    : countQuery

  const savedSearchPromise = user && canSaveSearch
    ? supabase
        .from("saved_searches")
        .select("id, is_active")
        .eq("catalog_path", savedSearchPath)
        .maybeSingle()
    : Promise.resolve({ data: null as { id: string; is_active: boolean } | null, error: null })

  const [
    rankedSearchResponse,
    listingsResponse,
    countResponse,
    sizesResponse,
    colorsResponse,
    citiesResponse,
    favoritesResponse,
    savedSearchResponse,
  ] = await Promise.all([
    rankedSearchPromise,
    listingsPromise,
    countPromise,
    supabase.from("sizes").select("label, group_name, sort_order").order("group_name", { ascending: true }).order("sort_order", { ascending: true }),
    supabase.from("listings_catalog").select("color").eq("status", "active"),
    supabase.from("listings_catalog").select("city").eq("status", "active"),
    user
      ? supabase.from("favorites").select("listing_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { listing_id: string }[], error: null }),
    savedSearchPromise,
  ])

  const rankedPayload = (rankedSearchResponse.data ?? null) as RankedSearchPayload | null
  const listings = useRankedSearch
    ? Array.isArray(rankedPayload?.items)
      ? rankedPayload.items
      : []
    : (listingsResponse.data ?? []) as CatalogListing[]
  const totalCount = useRankedSearch
    ? Math.max(0, Number(rankedPayload?.total_count ?? 0))
    : countResponse.count ?? 0
  const sizes = sizesResponse.data
  const colorsRaw = colorsResponse.data
  const citiesRaw = citiesResponse.data

  const queryError =
    rankedSearchResponse.error ||
    listingsResponse.error ||
    countResponse.error ||
    sizesResponse.error ||
    colorsResponse.error ||
    citiesResponse.error ||
    favoritesResponse.error ||
    savedSearchResponse.error

  if (queryError) {
    throw new Error(`catalog_data_failed:${queryError.message}`)
  }

  const categories = CATALOG_SECTION_OPTIONS.map((item) => ({ slug: item.value, name: item.label }))
  const uniqueColors = Array.from(new Set((colorsRaw ?? []).map((item: { color?: string | null }) => normalizeText(item?.color)).filter(Boolean)))
  const legacyCities = (citiesRaw ?? []).map((item: { city?: string | null }) => normalizeText(item?.city)).filter(Boolean)
  const cityOptions = Array.from(new Set([...GEORGIA_CITIES, ...legacyCities]))

  const favoriteIds = (favoritesResponse.data ?? []).map((item) => item.listing_id)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const savedSearch = savedSearchResponse.data as { id: string; is_active: boolean } | null
  const searchId = q ? randomUUID() : null

  if (searchId) {
    const { data: recorded, error: analyticsError } = await supabase.rpc("record_search_impression", {
      p_search_id: searchId,
      p_query: q,
      p_filters: {
        category,
        item_type,
        brand,
        size,
        color,
        city,
        condition,
        gender,
        vip,
        min_price,
        max_price,
      },
      p_sort: sort,
      p_page: page,
      p_result_count: totalCount,
      p_listing_ids: listings.map((item) => item.id),
    })

    if (analyticsError || recorded !== true) {
      console.error(
        "[search-analytics] impression failed",
        analyticsError?.message || "record_search_impression returned false",
      )
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-bg text-text">
        <section className="ui-container py-7 sm:py-10">
          <CatalogPageHeader totalCount={totalCount} />

          <CatalogLandingFilters
            categories={categories}
            sizes={sizes ?? []}
            colors={uniqueColors}
            cities={cityOptions}
            values={filterValues}
          />

          <SavedSearchControls
            values={filterValues}
            signedIn={Boolean(user)}
            canSave={canSaveSearch}
            savedExists={Boolean(savedSearch)}
            savedActive={Boolean(savedSearch?.is_active)}
            status={savedSearchStatus}
          />

          <div className="mt-8">
            <CatalogResultsGrid
              listings={listings}
              currentPath={currentPath}
              favoriteIds={favoriteIds}
              searchId={searchId}
            />
          </div>

          <div className="mt-10">
            <CatalogPagination page={page} totalPages={totalPages} totalItems={totalCount} pageSize={PAGE_SIZE} pageHref={(nextPage: number) => getCatalogPath(queryParams, nextPage)} />
          </div>
        </section>
      </main>
    </>
  )
}
