import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import type { CatalogListing } from "@/types/marketplace"

export const baseListingSelect =
  "id, seller_id, slug, title, description, price, currency, condition, city, material, color, gender, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, cover_image_url, published_at, favorites_count, views_count, status"

export type MegaMenuItem = {
  label: string
  count: number
  featured?: boolean
}

export type TopCategoryMenu = {
  label: string
  gender: "women" | "men" | "kids"
  widthClass: string
  dropdownOffsetClass: string
  columns: readonly (readonly MegaMenuItem[])[]
}

export const topCategories: readonly TopCategoryMenu[] = [
  {
    label: "ქალებისთვის",
    gender: "women",
    widthClass: "lg:w-[250px]",
    dropdownOffsetClass: "left-0",
    columns: [
      [
        { label: "მაისურები", count: 145, featured: true },
        { label: "ტოპები", count: 20 },
        { label: "ბლუზები", count: 65 },
        { label: "პერანგები", count: 45 },
        { label: "ქვედაბოლოები", count: 65 },
      ],
      [
        { label: "სვიტერები", count: 68 },
        { label: "ჰუდები", count: 89 },
        { label: "ჟაკეტები/პიჯაკები", count: 90 },
        { label: "ქურთუკები", count: 92 },
        { label: "პალტოები", count: 92 },
      ],
      [
        { label: "ჯინსები", count: 13 },
        { label: "შარვლები", count: 67 },
        { label: "ლეგინსები", count: 89 },
        { label: "შორტები", count: 34 },
        { label: "სპორტული ტანსაცმელი", count: 14 },
      ],
      [
        { label: "საცვლები/პიჟამო", count: 41 },
        { label: "საღამოს ტანსაცმელი", count: 90 },
        { label: "ფეხსაცმელი", count: 65 },
        { label: "ჩანთები", count: 87 },
        { label: "აქსესუარები", count: 65 },
      ],
    ],
  },
  {
    label: "მამაკაცებისთვის",
    gender: "men",
    widthClass: "lg:w-[290px]",
    dropdownOffsetClass: "lg:left-[-250px]",
    columns: [
      [
        { label: "მაისურები", count: 84, featured: true },
        { label: "პოლო", count: 26 },
        { label: "პერანგები", count: 49 },
        { label: "ჰუდები", count: 57 },
        { label: "სვიტერები", count: 38 },
      ],
      [
        { label: "ჯინსები", count: 73 },
        { label: "შარვლები", count: 61 },
        { label: "შორტები", count: 35 },
        { label: "სპორტული კოსტიუმი", count: 28 },
        { label: "პიჯაკები", count: 18 },
      ],
      [
        { label: "ქურთუკები", count: 46 },
        { label: "პალტოები", count: 11 },
        { label: "სარჩულები", count: 14 },
        { label: "სპორტული ტანსაცმელი", count: 52 },
        { label: "სამუშაო ტანსაცმელი", count: 9 },
      ],
      [
        { label: "ფეხსაცმელი", count: 77 },
        { label: "ჩანთები", count: 19 },
        { label: "ქამრები", count: 22 },
        { label: "საათი", count: 17 },
        { label: "აქსესუარები", count: 31 },
      ],
    ],
  },
  {
    label: "ბავშვებისთვის",
    gender: "kids",
    widthClass: "lg:w-[250px]",
    dropdownOffsetClass: "lg:left-[-540px]",
    columns: [
      [
        { label: "გოგო • მაისურები", count: 42, featured: true },
        { label: "გოგო • კაბები", count: 36 },
        { label: "გოგო • ქვედაბოლოები", count: 18 },
        { label: "გოგო • პერანგები", count: 12 },
        { label: "გოგო • პიჟამო", count: 15 },
      ],
      [
        { label: "ბიჭი • მაისურები", count: 38 },
        { label: "ბიჭი • ჰუდები", count: 21 },
        { label: "ბიჭი • ჯინსები", count: 19 },
        { label: "ბიჭი • შორტები", count: 17 },
        { label: "ბიჭი • სპორტული", count: 14 },
      ],
      [
        { label: "ჩვილები", count: 27 },
        { label: "ბოდეები", count: 22 },
        { label: "კომბინიზონები", count: 16 },
        { label: "ქურთუკები", count: 11 },
        { label: "საძილე ტანსაცმელი", count: 13 },
      ],
      [
        { label: "ფეხსაცმელი", count: 24 },
        { label: "ჩანთები", count: 8 },
        { label: "ქუდები", count: 12 },
        { label: "აქსესუარები", count: 20 },
        { label: "სასკოლო ნივთები", count: 9 },
      ],
    ],
  },
] as const

const collectionDefinitions = [
  { title: "ჯინსები", href: "/catalog?query=%E1%83%AF%E1%83%98%E1%83%9C%E1%83%A1%E1%83%94%E1%83%91%E1%83%98", matchers: ["jean", "denim", "ჯინს"] },
  { title: "პერანგები", href: "/catalog?query=%E1%83%9E%E1%83%94%E1%83%A0%E1%83%90%E1%83%9C%E1%83%92%E1%83%98", matchers: ["shirt", "oxford", "პერანგ"] },
  { title: "სპორტი", href: "/catalog?query=%E1%83%A1%E1%83%9E%E1%83%9D%E1%83%A0%E1%83%A2", matchers: ["sport", "tracksuit", "training", "north face", "სპორტ"] },
  { title: "ფეხსაცმელი", href: "/catalog?category=shoes", matchers: ["shoe", "sneaker", "boot", "loafer", "heel", "ფეხსაცმ"] },
  { title: "პიჯაკები", href: "/catalog?query=%E1%83%9E%E1%83%98%E1%83%AF%E1%83%90%E1%83%99%E1%83%98", matchers: ["jacket", "blazer", "coat", "leather", "პიჯაკ", "ქურთ"] },
  { title: "მაისურები", href: "/catalog?query=%E1%83%9B%E1%83%90%E1%83%98%E1%83%A1%E1%83%A3%E1%83%A0%E1%83%98", matchers: ["t-shirt", "tee", "top", "მაისურ"] },
] as const

export type HomePageCollection = {
  title: string
  href: string
  item: CatalogListing | null
}

export type HomeHeroImages = {
  left: CatalogListing | undefined
  right: CatalogListing | undefined
  rightSmall: CatalogListing | undefined
}

export type HomePageData = {
  user: User | null
  profileLabel: string
  heroImages: HomeHeroImages
  showcaseImage: string | null
  bannerItems: CatalogListing[]
  collections: HomePageCollection[]
  latestSectionItems: CatalogListing[]
  vipSectionItems: CatalogListing[]
  activeCount: number
  vipCount: number
}

function listingSearchText(item: CatalogListing) {
  return [
    item.title,
    item.description,
    item.category_name,
    item.category_slug,
    item.brand_name,
    item.material,
    item.color,
    item.gender,
    item.city,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function pickListing(items: CatalogListing[], matchers: readonly string[], excludeIds = new Set<string>()) {
  return (
    items.find((item) => item.id && !excludeIds.has(item.id) && matchers.some((matcher) => listingSearchText(item).includes(matcher))) ??
    items.find((item) => item.id && !excludeIds.has(item.id)) ??
    null
  )
}

function uniqueListings(...groups: CatalogListing[][]) {
  const seen = new Set<string>()
  const output: CatalogListing[] = []

  for (const group of groups) {
    for (const item of group) {
      if (!item?.id || seen.has(item.id)) continue
      seen.add(item.id)
      output.push(item)
    }
  }

  return output
}

export function formatPrice(price: number, currency: string) {
  const formatted = new Intl.NumberFormat("ka-GE", {
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
  }).format(Number.isFinite(price) ? price : 0)

  return currency === "GEL" ? `${formatted} ₾` : `${formatted} ${currency}`
}

export function estimateOldPrice(price: number) {
  return Math.round(price * 1.28)
}

export function formatRelativeAge(value?: string | null) {
  if (!value) return "ახლახან"

  const published = new Date(value)
  const diffMs = Date.now() - published.getTime()

  if (!Number.isFinite(diffMs) || diffMs <= 0) return "ახლახან"

  const minutes = Math.max(1, Math.round(diffMs / 60000))
  if (minutes < 60) return `${minutes} წუთის`

  const hours = Math.max(1, Math.round(minutes / 60))
  if (hours < 24) return `${hours} საათის`

  const days = Math.max(1, Math.round(hours / 24))
  if (days < 30) return `${days} დღის`

  const months = Math.max(1, Math.round(days / 30))
  return `${months} თვის`
}

export function formatCount(count: number) {
  return `${new Intl.NumberFormat("ka-GE").format(count)} განცხადება`
}

export function sellerLabel(item: CatalogListing) {
  return item.seller_username || item.seller_full_name || "Nickname"
}

function getHeroImages(items: CatalogListing[]): HomeHeroImages {
  const [left, right, rightSmall] = items
  return { left, right, rightSmall }
}

export async function getHomePageData(): Promise<HomePageData> {
  const supabase = await createClient()

  const [authResponse, featuredResponse, vipResponse, latestResponse, popularResponse, activeCountResponse, vipCountResponse] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("listings_catalog")
        .select(baseListingSelect)
        .eq("status", "active")
        .eq("is_featured", true)
        .order("featured_slot", { ascending: true, nullsFirst: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(12),
      supabase
        .from("listings_catalog")
        .select(baseListingSelect)
        .eq("status", "active")
        .or("is_vip.eq.true,is_featured.eq.true")
        .order("is_featured", { ascending: false })
        .order("is_vip", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(12),
      supabase
        .from("listings_catalog")
        .select(baseListingSelect)
        .eq("status", "active")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(24),
      supabase
        .from("listings_catalog")
        .select(baseListingSelect)
        .eq("status", "active")
        .order("favorites_count", { ascending: false, nullsFirst: false })
        .order("views_count", { ascending: false, nullsFirst: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(12),
      supabase.from("listings_catalog").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase
        .from("listings_catalog")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .or("is_vip.eq.true,is_featured.eq.true"),
    ])

  const user = authResponse.data.user
  const featuredItems = (featuredResponse.data ?? []) as CatalogListing[]
  const vipItems = (vipResponse.data ?? []) as CatalogListing[]
  const latestItems = (latestResponse.data ?? []) as CatalogListing[]
  const popularItems = (popularResponse.data ?? []) as CatalogListing[]

  const profileResponse = user
    ? await supabase.from("profiles").select("full_name, username").eq("id", user.id).maybeSingle()
    : ({ data: null } as { data: { full_name?: string | null; username?: string | null } | null })

  const profileLabel = profileResponse.data?.full_name || profileResponse.data?.username || "პროფილი"
  const combinedItems = uniqueListings(featuredItems, vipItems, latestItems, popularItems)
  const heroImages = getHeroImages(combinedItems.slice(0, 3))
  const showcaseImage = featuredItems[0]?.cover_image_url || latestItems[0]?.cover_image_url || vipItems[0]?.cover_image_url || null

  const collectionUsedIds = new Set<string>()
  const collections = collectionDefinitions.map((definition) => {
    const item = pickListing(combinedItems, definition.matchers, collectionUsedIds)
    if (item?.id) collectionUsedIds.add(item.id)
    return { ...definition, item }
  })

  const shoeMatch = ["shoe", "sneaker", "boot", "loafer", "heel", "ფეხსაცმ"]
  const bannerUsedIds = new Set<string>()
  const bannerItems = Array.from({ length: 4 }, () => {
    const item = pickListing(combinedItems, shoeMatch, bannerUsedIds)
    if (item?.id) bannerUsedIds.add(item.id)
    return item
  }).filter(Boolean) as CatalogListing[]

  return {
    user,
    profileLabel,
    heroImages,
    showcaseImage,
    bannerItems,
    collections,
    latestSectionItems: latestItems.slice(0, 5),
    vipSectionItems: uniqueListings(vipItems, featuredItems).slice(0, 5),
    activeCount: activeCountResponse.count ?? latestItems.length,
    vipCount: vipCountResponse.count ?? uniqueListings(vipItems, featuredItems).length,
  }
}
