import { catalogCategoryHref } from "@/lib/catalog-urls"
import type { User } from "@supabase/supabase-js"
import { unstable_cache } from "next/cache"
import MarketplaceHeader from "@/components/layout/MarketplaceHeader"
import type { MarketplaceNavItem } from "@/components/layout/MobileNavigation"
import { getCatalogItemLabel } from "@/lib/catalog-taxonomy"
import { getUserAvatar } from "@/lib/profiles"
import { createClient } from "@/lib/supabase/server"
import { createPublicServerClient } from "@/lib/supabase/public-server"

const supportingItems: MarketplaceNavItem[] = [
  { label: "ბავშვებისთვის", href: "/catalog/kids" },
  { label: getCatalogItemLabel("footwear"), href: "/catalog/footwear" },
  { label: getCatalogItemLabel("bags"), href: "/catalog/bags" },
]

const perfumeItem: MarketplaceNavItem = {
  label: "პარფიუმერია",
  href: "/catalog/perfume",
}

const marketplaceNavOrder = [
  "/catalog/women",
  "/catalog/men",
  "/catalog/kids",
  "/catalog/footwear",
  "/catalog/bags",
  "/catalog/vintage",
  "/catalog/accessories",
  "/catalog/perfume",
] as const

export const getMarketplaceNavigationItems = unstable_cache(
  async (): Promise<MarketplaceNavItem[]> => {
    const supabase = createPublicServerClient()
    const { data } = await supabase
      .from("categories")
      .select("slug, name, navigation_label, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })

    const databaseItems = (data ?? [])
      .filter((item) => item.slug && item.name)
      .map((item) => ({
        label: item.navigation_label || item.name,
        href: catalogCategoryHref(item.slug),
      }))

    const hasPerfume = databaseItems.some((item) => item.href === perfumeItem.href)
    const databaseWithPerfume = hasPerfume
      ? databaseItems
      : databaseItems.flatMap((item) =>
          item.href === "/catalog/accessories"
            ? [item, perfumeItem]
            : [item],
        )

    const seen = new Set<string>()
    const mergedItems = [...databaseWithPerfume, ...supportingItems].filter((item) => {
      if (!item.label || seen.has(item.href)) return false
      seen.add(item.href)
      return true
    })

    const order = new Map<string, number>(
      marketplaceNavOrder.map((href, index) => [href, index]),
    )
    return mergedItems.sort((a, b) => {
      const aOrder = order.get(a.href) ?? Number.MAX_SAFE_INTEGER
      const bOrder = order.get(b.href) ?? Number.MAX_SAFE_INTEGER
      return aOrder - bOrder
    })
  },
  ["marketplace-header-navigation-v4-clean-categories"],
  {
    revalidate: 600,
    tags: ["marketplace-navigation"],
  },
)

export default async function SiteHeader({ authenticatedUser }: { authenticatedUser?: Pick<User, "id"> | null } = {}) {
  const itemsPromise = getMarketplaceNavigationItems()

  if (authenticatedUser === null) {
    const items = await itemsPromise
    return (
      <MarketplaceHeader
        key="guest"
        items={items}
        userState={{
          userId: null,
          signedIn: false,
          profileLabel: "პროფილი",
          profileImage: null,
          isAdmin: false,
          unreadNotifications: 0,
          unreadChats: 0,
        }}
      />
    )
  }

  const supabase = await createClient()
  const [user, items] = await Promise.all([
    authenticatedUser === undefined
      ? supabase.auth.getUser().then((response) => response.data.user)
      : Promise.resolve(authenticatedUser),
    itemsPromise,
  ])

  let profile: {
    is_admin: boolean
    avatar_url: string | null
    full_name: string | null
    username: string | null
    store_logo_url: string | null
    seller_type: string
  } | null = null
  let unreadNotifications = 0
  let unreadChats = 0

  if (user) {
    const [profileResponse, unreadResponse, chatUnreadResponse] = await Promise.all([
      supabase
        .from("profiles")
        .select("is_admin, avatar_url, full_name, username, store_logo_url, seller_type")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null).not("type", "in", "(chat_started,chat_message)"),
      supabase.from("notifications").select("id", { count: "exact", head: true })
        .is("read_at", null).in("type", ["chat_started", "chat_message"]),
    ])

    profile = profileResponse.data
    if (!unreadResponse.error) unreadNotifications = unreadResponse.count ?? 0
    if (!chatUnreadResponse.error) unreadChats = chatUnreadResponse.count ?? 0
  }

  const profileLabel = profile?.full_name || profile?.username || "პროფილი"

  return (
    <MarketplaceHeader
      key={user?.id ?? "guest"}
      items={items}
      userState={{
        userId: user?.id ?? null,
        signedIn: Boolean(user),
        profileLabel,
        profileImage: getUserAvatar(profile),
        isAdmin: Boolean(profile?.is_admin),
        unreadNotifications,
        unreadChats,
      }}
    />
  )
}
