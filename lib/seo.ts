import { getSiteUrlEnv } from "@/lib/env"
import { SITE_DESCRIPTION_EN, SITE_NAME } from "@/lib/site"
import type { CatalogListing } from "@/types/marketplace"

export const GOOGLE_SITE_VERIFICATION = "uQuez09mPR--nX75FjQfxC1lHoSPZ4Kp19VP2rdNhf0"

export const INDEXABLE_CATALOG_CATEGORIES = [
  { value: "women", label: "ქალებისთვის" },
  { value: "men", label: "მამაკაცებისთვის" },
  { value: "accessories", label: "აქსესუარები" },
  { value: "kids", label: "ბავშვებისთვის" },
  { value: "vintage", label: "ვინტაჟი" },
  { value: "footwear", label: "ფეხსაცმელი" },
  { value: "bags", label: "ჩანთები" },
] as const

export function getSiteUrl() {
  return getSiteUrlEnv().replace(/\/$/, "")
}

export function absoluteUrl(path = "/") {
  if (!path.startsWith("/")) path = `/${path}`
  return `${getSiteUrl()}${path}`
}

export function stripHtml(value?: string | null) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export function truncateDescription(value?: string | null, maxLength = 160) {
  const safe = stripHtml(value)
  if (!safe) return ""
  if (safe.length <= maxLength) return safe
  return `${safe.slice(0, maxLength - 1).trim()}…`
}

export function buildCatalogTitle(page = 1, categoryLabel = "") {
  const base = categoryLabel ? `${categoryLabel} — კატალოგი` : "კატალოგი"
  return page > 1 ? `${base} — გვერდი ${page}` : base
}

export function buildCatalogDescription(filters: string[] = []) {
  const base = SITE_DESCRIPTION_EN
  if (filters.length === 0) return base
  return `${base} აქტიური ფილტრები: ${filters.join(", ")}.`
}

export function buildCatalogCanonicalPath({
  page,
  category,
  hasOtherFilters,
  hasSortParameter,
  hasTransientState,
}: {
  page: number
  category?: string
  hasOtherFilters: boolean
  hasSortParameter: boolean
  hasTransientState: boolean
}) {
  const canonicalCategory = INDEXABLE_CATALOG_CATEGORIES.find(
    (item) => item.value === category,
  )
  const indexable =
    (!category || Boolean(canonicalCategory)) &&
    !hasOtherFilters &&
    !hasSortParameter &&
    !hasTransientState
  const canonicalRoot = canonicalCategory
    ? `/catalog?category=${canonicalCategory.value}`
    : "/catalog"

  return {
    canonicalPath:
      indexable && page > 1
        ? `${canonicalRoot}${canonicalCategory ? "&" : "?"}page=${page}`
        : canonicalRoot,
    indexable,
    categoryLabel: canonicalCategory?.label ?? "",
  }
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

export function buildHomeStructuredData() {
  const siteUrl = getSiteUrl()

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: siteUrl,
        logo: absoluteUrl("/logo-master.png"),
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: SITE_NAME,
        url: siteUrl,
        inLanguage: "ka-GE",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  }
}

function schemaCondition(condition: string) {
  return condition === "new"
    ? "https://schema.org/NewCondition"
    : "https://schema.org/UsedCondition"
}

export function buildListingStructuredData(
  listing: CatalogListing,
  imageUrls: string[] = [],
) {
  const listingUrl = absoluteUrl(`/listing/${listing.slug}`)
  const images = Array.from(
    new Set(
      [listing.cover_image_url, ...imageUrls]
        .filter((value): value is string => Boolean(value))
        .map((value) => (value.startsWith("/") ? absoluteUrl(value) : value)),
    ),
  )
  const condition = schemaCondition(listing.condition)
  const product: Record<string, unknown> = {
    "@type": "Product",
    "@id": `${listingUrl}#product`,
    name: listing.title,
    description:
      truncateDescription(listing.description, 500) ||
      [listing.category_name, listing.brand_name].filter(Boolean).join(" · "),
    sku: listing.id,
    url: listingUrl,
    category: listing.category_name,
    itemCondition: condition,
    offers: {
      "@type": "Offer",
      url: listingUrl,
      price: Number(listing.price).toFixed(2),
      priceCurrency: listing.currency || "GEL",
      availability: "https://schema.org/InStock",
      itemCondition: condition,
    },
  }

  if (images.length > 0) product.image = images
  if (listing.brand_name) {
    product.brand = { "@type": "Brand", name: listing.brand_name }
  }
  if (listing.color) product.color = listing.color
  if (listing.material) product.material = listing.material
  if (listing.size_label) product.size = listing.size_label

  return {
    "@context": "https://schema.org",
    "@graph": [
      product,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "მთავარი",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "კატალოგი",
            item: absoluteUrl("/catalog"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: listing.title,
            item: listingUrl,
          },
        ],
      },
    ],
  }
}
