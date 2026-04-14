import type { Metadata } from "next"
import SiteHeader from "@/components/layout/SiteHeader"
import CatalogLandingFilters from "@/components/listings/CatalogLandingFilters"
import CatalogPagination from "@/components/listings/CatalogPagination"
import CatalogPageHeader from "@/components/listings/CatalogPageHeader"
import CatalogResultsGrid from "@/components/listings/CatalogResultsGrid"
import CatalogTopSectionsNav from "@/components/listings/CatalogTopSectionsNav"
import {
  PAGE_SIZE,
  applyCatalogFilters,
  getCatalogPath,
  normalizeText,
  resolveCatalogState,
  type CatalogSearchParams,
  summarizeFilters,
} from "@/lib/catalog-page"
import { absoluteUrl, buildCatalogDescription, buildCatalogTitle } from "@/lib/seo"
import { createClient } from "@/lib/supabase/server"
import type { CatalogListing } from "@/types/marketplace"

export async function generateMetadata({ searchParams }: { searchParams?: Promise<CatalogSearchParams> }): Promise<Metadata> {
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

export default async function CatalogPage({ searchParams }: { searchParams?: Promise<CatalogSearchParams> }) {
  const params = (await searchParams) ?? {}
  const { filters, sort, page, queryParams, currentPath } = resolveCatalogState(params)
  const { q, category, brand, size, color, city, condition, gender, vip, min_price, max_price } = filters

  const rangeFrom = (page - 1) * PAGE_SIZE
  const rangeTo = rangeFrom + PAGE_SIZE - 1

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let listingsQuery = applyCatalogFilters(
    supabase
      .from("listings_catalog")
      .select(
        "id, seller_id, slug, title, description, price, currency, condition, city, material, color, gender, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, cover_image_url, published_at, favorites_count, views_count, status"
      )
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
      listingsQuery = listingsQuery.order("is_featured", { ascending: false }).order("is_promoted", { ascending: false }).order("is_vip", { ascending: false }).order("published_at", { ascending: false, nullsFirst: false })
      break
    default:
      listingsQuery = listingsQuery.order("is_featured", { ascending: false }).order("featured_slot", { ascending: true, nullsFirst: false }).order("is_promoted", { ascending: false }).order("is_vip", { ascending: false }).order("published_at", { ascending: false, nullsFirst: false })
      break
  }

  listingsQuery = listingsQuery.range(rangeFrom, rangeTo)

  const [
    listingsResponse,
    countResponse,
    categoriesResponse,
    brandsResponse,
    sizesResponse,
    colorsResponse,
    citiesResponse,
    favoritesResponse,
  ] = await Promise.all([
    listingsQuery,
    countQuery,
    supabase.from("categories").select("slug, name").order("name", { ascending: true }),
    supabase.from("brands").select("name").order("name", { ascending: true }),
    supabase.from("sizes").select("label").order("label", { ascending: true }),
    supabase.from("listings_catalog").select("color").eq("status", "active"),
    supabase.from("listings_catalog").select("city").eq("status", "active"),
    user ? supabase.from("favorites").select("listing_id").eq("user_id", user.id) : Promise.resolve({ data: [] as { listing_id: string }[] }),
  ])

  const listings = (listingsResponse.data ?? []) as CatalogListing[]
  const totalCount = countResponse.count ?? 0
  const categories = categoriesResponse.data
  const brands = brandsResponse.data
  const sizes = sizesResponse.data
  const colorsRaw = colorsResponse.data
  const citiesRaw = citiesResponse.data

  const sellerIds = Array.from(new Set(listings.map((item) => item.seller_id).filter(Boolean))) as string[]
  const sellerCountsResponse = sellerIds.length > 0
    ? await supabase.from("listings_catalog").select("seller_id").eq("status", "active").in("seller_id", sellerIds)
    : { data: [] as { seller_id?: string | null }[] }

  const sellerItemCounts = Object.fromEntries(
    sellerIds.map((sellerId) => [sellerId, (sellerCountsResponse.data ?? []).filter((row) => row.seller_id === sellerId).length])
  ) as Record<string, number>

  const uniqueCategories = Array.from(
    new Map((categories ?? []).filter((item) => item.slug && item.name).map((item) => [item.slug, item] as const)).values()
  )
  const uniqueBrands = Array.from(new Set((brands ?? []).map((item: { name?: string | null }) => normalizeText(item?.name)).filter(Boolean)))
  const uniqueSizes = Array.from(new Set((sizes ?? []).map((item: { label?: string | null }) => normalizeText(item?.label)).filter(Boolean)))
  const uniqueColors = Array.from(new Set((colorsRaw ?? []).map((item: { color?: string | null }) => normalizeText(item?.color)).filter(Boolean)))
  const cityOptions = Array.from(new Set((citiesRaw ?? []).map((item: { city?: string | null }) => normalizeText(item?.city)).filter(Boolean)))

  const favoriteIds = (favoritesResponse.data ?? []).map((item) => item.listing_id)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <main className="min-h-screen bg-[#F5F5F5] text-[#2D2D2D]">
      <SiteHeader />
      <CatalogTopSectionsNav gender={gender} />

      <section className="mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <CatalogPageHeader totalCount={totalCount} />

        <CatalogLandingFilters
          categories={uniqueCategories}
          brands={uniqueBrands}
          sizes={uniqueSizes}
          colors={uniqueColors}
          cities={cityOptions}
          values={{ q, category, brand, size, color, city, condition, gender, vip, sort, min_price, max_price }}
        />

        <div className="mt-8">
          <CatalogResultsGrid listings={listings} currentPath={currentPath} favoriteIds={favoriteIds} sellerItemCounts={sellerItemCounts} />
        </div>

        <div className="mt-10">
          <CatalogPagination page={page} totalPages={totalPages} totalItems={totalCount} pageSize={PAGE_SIZE} pageHref={(nextPage: number) => getCatalogPath(queryParams, nextPage)} />
        </div>
      </section>
    </main>
  )
}
