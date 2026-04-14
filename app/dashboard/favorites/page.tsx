import { requireAuthenticatedUser } from "@/lib/auth"
import Link from "next/link"
import CatalogListingCard from "@/components/listings/CatalogListingCard"
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
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
            რჩეულები
          </div>
          <h1 className="mt-3 text-4xl font-black">შენახული ნივთები</h1>
          <p className="mt-3 max-w-2xl text-neutral-600">
            აქ ნახავ შენს ფავორიტებში დამატებულ აქტიურ განცხადებებს. გულის ღილაკით ნებისმიერ დროს
            შეგიძლია ამოშალო სიიდან.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/catalog"
            className="rounded-full border border-neutral-300 px-4 py-2 font-semibold text-neutral-700"
          >
            კატალოგი
          </Link>
          <Link
            href="/dashboard/chats"
            className="rounded-full border border-neutral-300 px-4 py-2 font-semibold text-neutral-700"
          >
            ჩათები
          </Link>
        </div>
      </div>

      {orderedListings.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="rounded-[2rem] border border-dashed border-neutral-300 bg-white p-10 text-neutral-600">
          <div className="text-2xl font-black text-neutral-900">ჯერ არაფერი გაქვს შენახული</div>
          <p className="mt-3 max-w-2xl leading-7">
            გადადი კატალოგში, მონიშნე სასურველი ნივთები გულის ღილაკით და ეს გვერდი ავტომატურად
            შეივსება.
          </p>
          <div className="mt-6">
            <Link href="/catalog" className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">
              კატალოგის გახსნა
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
