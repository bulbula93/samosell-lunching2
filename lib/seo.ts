import { SITE_DESCRIPTION_EN, SITE_NAME } from "@/lib/site"
import type { CatalogListing } from "@/types/marketplace"

export const GOOGLE_SITE_VERIFICATION = "uQuez09mPR--nX75FjQfxC1lHoSPZ4Kp19VP2rdNhf0"
export const SITE_URL = "https://samosell.ge"

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
  return SITE_URL
}

export function absoluteUrl(path = "/") {
  if (!path.startsWith("/")) path = `/${path}`
  return `${getSiteUrl()}${path}`
}

export function stripHtml(value?: string | null) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

const SHORT_META_DESCRIPTION_THRESHOLD = 90
const SHORT_META_DESCRIPTION_SUFFIX =
  "დამატებითი დეტალები, ფოტოები და სხვა აქტიური შეთავაზებები ნახე SamoSell-ზე."

export function truncateDescription(value?: string | null, maxLength = 160) {
  const safe = stripHtml(value)
  if (!safe) return ""

  const shouldEnrichForMeta =
    maxLength <= 180 && safe.length < SHORT_META_DESCRIPTION_THRESHOLD
  const punctuation = /[.!?…]$/.test(safe) ? "" : "."
  const enriched = shouldEnrichForMeta
    ? `${safe}${punctuation} ${SHORT_META_DESCRIPTION_SUFFIX}`
    : safe

  if (enriched.length <= maxLength) return enriched
  return `${enriched.slice(0, maxLength - 1).trim()}…`
}

export function buildCatalogTitle(page = 1, categoryLabel = "") {
  const base = categoryLabel
    ? `${categoryLabel} — კატალოგი`
    : "მეორადი ტანსაცმლის კატალოგი საქართველოში"
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

export function buildCatalogStructuredData({
  canonicalPath,
  title,
  description,
  categoryLabel,
  page = 1,
  listings,
}: {
  canonicalPath: string
  title: string
  description: string
  categoryLabel?: string
  page?: number
  listings: CatalogListing[]
}) {
  const pageUrl = absoluteUrl(canonicalPath)
  const itemListId = `${pageUrl}#item-list`
  const collectionId = `${pageUrl}#collection`
  const breadcrumbItems: Array<Record<string, unknown>> = [
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
  ]

  if (categoryLabel) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 3,
      name: categoryLabel,
      item: absoluteUrl(
        `/catalog?category=${encodeURIComponent(
          INDEXABLE_CATALOG_CATEGORIES.find((item) => item.label === categoryLabel)?.value ?? "",
        )}`,
      ),
    })
  }

  if (page > 1) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: `გვერდი ${page}`,
      item: pageUrl,
    })
  }

  const listItems = listings.map((listing, index) => ({
    "@type": "ListItem",
    position: (page - 1) * 24 + index + 1,
    url: absoluteUrl(`/listing/${listing.slug}`),
    name: listing.title,
    ...(listing.cover_image_url
      ? {
          image: listing.cover_image_url.startsWith("/")
            ? absoluteUrl(listing.cover_image_url)
            : listing.cover_image_url,
        }
      : {}),
  }))

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": collectionId,
        url: pageUrl,
        name: title,
        description,
        inLanguage: "ka-GE",
        isPartOf: { "@id": `${getSiteUrl()}/#website` },
        mainEntity: { "@id": itemListId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: categoryLabel ? `${categoryLabel} — SamoSell` : "SamoSell კატალოგი",
        numberOfItems: listItems.length,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        itemListElement: listItems,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems,
      },
    ],
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
    sku: listing.public_id || listing.id,
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
