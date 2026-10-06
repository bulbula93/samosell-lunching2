import { SITE_DESCRIPTION_EN, SITE_NAME } from "@/lib/site"
import type { CatalogListing } from "@/types/marketplace"

export const GOOGLE_SITE_VERIFICATION = "uQuez09mPR--nX75FjQfxC1lHoSPZ4Kp19VP2rdNhf0"
export const SITE_URL = "https://samosell.ge"

import { INDEXABLE_CATALOG_CATEGORIES, catalogCategoryHref } from "@/lib/catalog-urls"
export { INDEXABLE_CATALOG_CATEGORIES } from "@/lib/catalog-urls"

export const CATEGORY_SEO = {
  women: {
    h1: "ქალის ტანსაცმელი და აქსესუარები",
    title: "ქალის ტანსაცმელი ონლაინ საქართველოში",
    description: "აღმოაჩინე ქალის მეორადი ტანსაცმელი და აქსესუარები SamoSell-ზე. შეარჩიე სტილი, ზომა და ფასი, დაუკავშირდი გამყიდველს ან გაყიდე ნივთები შენი გარდერობიდან.",
    intro: "აღმოაჩინე ქალის მეორადი ტანსაცმელი და აქსესუარები შენი სტილისთვის. შეარჩიე ზომა და ფასი ან გაყიდე ნივთები საკუთარი გარდერობიდან.",
  },
  men: {
    h1: "მამაკაცის ტანსაცმელი და აქსესუარები",
    title: "მამაკაცის ტანსაცმელი ონლაინ საქართველოში",
    description: "მამაკაცის მეორადი ტანსაცმელი და აქსესუარები საქართველოში — ყოველდღიური სამოსიდან გამორჩეულ ნივთებამდე. იყიდე ან გაყიდე პირდაპირ SamoSell-ის მომხმარებლებთან.",
    intro: "იპოვე მამაკაცის ტანსაცმელი და აქსესუარები ყოველდღიური თუ განსაკუთრებული შემთხვევებისთვის. შეადარე შეთავაზებები და დაუკავშირდი გამყიდველს.",
  },
  kids: {
    h1: "ბავშვის ტანსაცმელი",
    title: "ბავშვის ტანსაცმელი საქართველოში — ყიდვა და გაყიდვა",
    description: "ბავშვის ტანსაცმელი სხვადასხვა ასაკისა და სეზონისთვის SamoSell-ზე. მოძებნე სასურველი ზომა და ფასი ან გაყიდე კარგ მდგომარეობაში შენახული საბავშვო სამოსი.",
    intro: "შეარჩიე ბავშვის ტანსაცმელი სასურველი ზომისა და სეზონის მიხედვით. კარგ მდგომარეობაში შენახულ სამოსს ახალი პატრონი აქ მოუძებნე.",
  },
  footwear: {
    h1: "ფეხსაცმელი",
    title: "ფეხსაცმელი ონლაინ საქართველოში",
    description: "მოძებნე ფეხსაცმელი SamoSell-ზე — კედები, ბოტასები, ჩექმები და სხვა მოდელები. შეადარე ზომა, მდგომარეობა და ფასი, იყიდე ან გაყიდე საქართველოში.",
    intro: "კედები, ბოტასები, ჩექმები და სხვა ფეხსაცმელი ერთ სივრცეში. შეარჩიე ზომა, შეამოწმე მდგომარეობა და მოძებნე შენთვის შესაფერისი წყვილი.",
  },
  bags: {
    h1: "ჩანთები",
    title: "ჩანთები საქართველოში — ყიდვა და გაყიდვა ონლაინ",
    description: "ხელჩანთები, ზურგჩანთები და სხვა ჩანთები SamoSell-ზე. აღმოაჩინე მეორადი და ახალი ნივთები, შეადარე შეთავაზებები და დაუკავშირდი გამყიდველს საქართველოში.",
    intro: "აღმოაჩინე ხელჩანთები, ზურგჩანთები და ყოველდღიური ჩანთები. შეადარე სტილი და ფასი ან შენი ჩანთა ახალ პატრონს გაუზიარე.",
  },
  vintage: {
    h1: "ვინტაჟური ტანსაცმელი და ნივთები",
    title: "ვინტაჟური ტანსაცმელი და ნივთები საქართველოში",
    description: "აღმოაჩინე ვინტაჟური ტანსაცმელი და გამორჩეული ნივთები SamoSell-ზე. მოძებნე განსხვავებული სტილი, იყიდე ან გაყიდე შენი ვინტაჟური კოლექციის ნივთები საქართველოში.",
    intro: "აღმოაჩინე ვინტაჟური ტანსაცმელი და ნივთები საკუთარი ისტორიით. მოძებნე გამორჩეული სტილი ან გაყიდე ნივთები შენი კოლექციიდან.",
  },
  accessories: {
    h1: "აქსესუარები",
    title: "აქსესუარები ონლაინ საქართველოში",
    description: "სამკაულები, ქამრები, სათვალეები და სხვა აქსესუარები SamoSell-ზე. შეარჩიე დეტალები შენი სტილისთვის, შეადარე ფასები და იყიდე ან გაყიდე საქართველოში.",
    intro: "სამკაულები, ქამრები, სათვალეები და სხვა დეტალები შენი სტილისთვის. აღმოაჩინე აქსესუარები ან გაყიდე ნივთები, რომლებსაც აღარ იყენებ.",
  },
  perfume: {
    h1: "პარფიუმერია",
    title: "პარფიუმერია და სუნამოები საქართველოში",
    description: "სუნამოები და პარფიუმერია SamoSell-ზე — შეარჩიე ბრენდი, მოცულობა და მდგომარეობა. შეადარე შეთავაზებები და დაუკავშირდი გამყიდველს საქართველოში.",
    intro: "მოძებნე სუნამო სასურველი ბრენდისა და მოცულობის მიხედვით. შეამოწმე მდგომარეობა და დეტალები, შემდეგ დაუკავშირდი გამყიდველს.",
  },
} as const

export function getCategorySeo(category?: string) {
  return INDEXABLE_CATALOG_CATEGORIES.some((item) => item.value === category)
    ? CATEGORY_SEO[category as keyof typeof CATEGORY_SEO]
    : null
}

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
    ? catalogCategoryHref(canonicalCategory.value)
    : "/catalog"

  return {
    canonicalPath:
      indexable && page > 1
        ? `${canonicalRoot}?page=${page}`
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
        catalogCategoryHref(
          INDEXABLE_CATALOG_CATEGORIES.find((item) => item.label === categoryLabel)?.value,
        ),
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
