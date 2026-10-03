import { requireAuthenticatedUser } from "@/lib/auth"
import Link from "next/link"
import CatalogListingCard from "@/components/listings/CatalogListingCard"
import UiPageHeader from "@/components/shared/UiPageHeader"
import UiEmptyState from "@/components/shared/UiEmptyState"
import type { CatalogListing } from "@/types/marketplace"

type FavoriteRow = {
  listing_id: string
  created_at: string
}

export default async function DashboardFavoritesPage() {
  const { supabase, user } = await requireAuthenticatedUser("/dashboard/favorites")

  const { data: favoriteRows } = await supabase
    .from("favorites")
    .select("listing_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const orderedFavorites = (favoriteRows ?? []) as FavoriteRow[]
  const listingIds = orderedFavorites.map((item) => item.listing_id)

  const { data: listings } = listingIds.length
    ? await supabase
        .from("listings_catalog")
        .select(
          "id, seller_id, slug, title, description, price, currency, condition, city, material, color, gender, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, cover_image_url, published_at, favorites_count, views_count, status"
        )
        .eq("status", "active")
        .in("id", listingIds)
    : { data: [] as CatalogListing[] }

  const listingsMap = new Map((listings ?? []).map((item) => [item.id, item]))
  const orderedListings = listingIds
    .map((id) => listingsMap.get(id))
    .filter(Boolean) as CatalogListing[]

  return (
    <main className="ui-page-shell">
      <div className="ui-page-container max-w-7xl">
        <UiPageHeader
          eyebrow="რჩეულები"
          title="შენახული ნივთები"
          description="აქ ნახავ შენს ფავორიტებში დამატებულ აქტიურ განცხადებებს. თუ შენახულ ნივთს ფასი დაუკლეს, შეტყობინებას ავტომატურად მიიღებ."
          actions={
            <>
              <Link href="/catalog" className="ui-btn-secondary">კატალოგი</Link>
              <Link href="/dashboard/chats" className="ui-btn-secondary">ჩათები</Link>
            </>
          }
        />

      {orderedListings.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {orderedListings.map((item) => (
            <CatalogListingCard
              key={item.id}
              item={item}
              currentPath="/dashboard/favorites"
              isFavorited
            />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <UiEmptyState
            icon="♡"
            title="ჯერ არაფერი გაქვს შენახული"
            description="გადადი კატალოგში, მონიშნე სასურველი ნივთები გულის ღილაკით და ეს გვერდი ავტომატურად შეივსება. ფასის შემცირებისას განახლებას შეტყობინებებშიც ნახავ."
            actions={<Link href="/catalog" className="ui-btn-primary">კატალოგის გახსნა</Link>}
          />
        </div>
      )}
      </div>
    </main>
  )
}
