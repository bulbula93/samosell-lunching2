import type { User } from "@supabase/supabase-js"
import MarketplaceHeader from "@/components/layout/MarketplaceHeader"
import type { MarketplaceNavItem } from "@/components/layout/MobileNavigation"
import { getCatalogItemLabel } from "@/lib/catalog-taxonomy"
import { getUserAvatar } from "@/lib/profiles"
import { createClient } from "@/lib/supabase/server"

const categoryLabelOverrides: Record<string, string> = {
  women: "ქალებისთვის",
  men: "მამაკაცებისთვის",
  accessories: "აქსესუარები",
  vintage: "ვინტაჟი",
}

export default async function SiteHeader({ authenticatedUser }: { authenticatedUser?: Pick<User, "id"> | null } = {}) {
  const supabase = await createClient()
  const [user, categoriesResponse] = await Promise.all([
    authenticatedUser === undefined
      ? supabase.auth.getUser().then((response) => response.data.user)
      : Promise.resolve(authenticatedUser),
    supabase.from("categories").select("slug, name").order("id", { ascending: true }),
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

  if (user) {
    const [profileResponse, unreadResponse] = await Promise.all([
      supabase
        .from("profiles")
        .select("is_admin, avatar_url, full_name, username, store_logo_url, seller_type")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
    ])

    profile = profileResponse.data
    if (!unreadResponse.error) unreadNotifications = unreadResponse.count ?? 0
  }

  const profileLabel = profile?.full_name || profile?.username || "პროფილი"
  const databaseItems = (categoriesResponse.data ?? [])
    .filter((item) => item.slug && item.name)
    .map((item) => ({
      label: categoryLabelOverrides[item.slug] || item.name,
      href: `/catalog?category=${encodeURIComponent(item.slug)}`,
    }))

  const supportingItems: MarketplaceNavItem[] = [
    { label: "ბავშვებისთვის", href: "/catalog?category=kids" },
    { label: getCatalogItemLabel("footwear"), href: "/catalog?category=footwear" },
    { label: getCatalogItemLabel("bags"), href: "/catalog?category=bags" },
  ]

  const seen = new Set<string>()
  const items = [...databaseItems, ...supportingItems].filter((item) => {
    if (!item.label || seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })

  return (
    <MarketplaceHeader
      items={items}
      userState={{
        signedIn: Boolean(user),
        profileLabel,
        profileImage: getUserAvatar(profile),
        isAdmin: Boolean(profile?.is_admin),
        unreadNotifications,
      }}
    />
  )
}
