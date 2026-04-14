import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import SiteHeader from "@/components/layout/SiteHeader"
import Avatar from "@/components/shared/Avatar"
import SmartImage from "@/components/shared/SmartImage"
import CatalogListingCard from "@/components/listings/CatalogListingCard"
import ShareButton from "@/components/shared/ShareButton"
import StorefrontPanels from "@/components/shared/StorefrontPanels"
import { absoluteUrl, truncateDescription } from "@/lib/seo"
import { getUserAvatar, sellerTypeLabel } from "@/lib/profiles"
import { SITE_NAME } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"
import type { CatalogListing } from "@/types/marketplace"

const listingSelect =
  "id, seller_id, slug, title, description, price, currency, condition, city, material, color, gender, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, cover_image_url, published_at, favorites_count, views_count, status"

function formatJoinDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", { year: "numeric", month: "long" }).format(new Date(value))
}

function buildTrustReasons({
  isVerified,
  activeCount,
  totalViews,
  totalFavorites,
  city,
}: {
  isVerified: boolean
  activeCount: number
  totalViews: number
  totalFavorites: number
  city?: string | null
}) {
  const reasons: string[] = []
  if (isVerified) reasons.push("დადასტურებული გამყიდველის პროფილი")
  if (activeCount > 0) reasons.push(`${activeCount} აქტიური განცხადება კატალოგში`)
  if (totalViews > 0) reasons.push(`${totalViews} ჯამური ნახვა აქტიურ ნივთებზე`)
  if (totalFavorites > 0) reasons.push(`${totalFavorites} ფავორიტში დამატება აქტიურ ნივთებზე`)
  if (city) reasons.push(`განცხადებები ქვეყნდება ${city}-დან`)
  return reasons.slice(0, 4)
}

async function fetchSeller(username: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, bio, city, is_seller_verified, is_suspended, created_at, avatar_url, seller_type, store_logo_url, store_banner_url, store_phone, store_whatsapp, store_telegram, store_instagram, store_facebook, store_website, store_hours, store_address, store_map_url")
    .eq("username", username)
    .maybeSingle()
  if (!profile || profile.is_suspended) return null
  return profile
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params
  const profile = await fetchSeller(username)
  if (!profile) return { title: "გამყიდველი ვერ მოიძებნა", robots: { index: false, follow: false } }
  const title = `${profile.full_name || profile.username} — ${SITE_NAME} სელერი`
  const description = truncateDescription(profile.bio || `${profile.full_name || profile.username} სელერის საჯარო პროფილი ${SITE_NAME}-ზე.`, 155)
  const path = `/seller/${profile.username}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: absoluteUrl(path), type: "profile", images: [{ url: absoluteUrl("/opengraph-image") }] },
    twitter: { card: "summary_large_image", title, description, images: [absoluteUrl("/opengraph-image")] },
  }
}

export default async function SellerPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, bio, city, is_seller_verified, is_suspended, created_at, avatar_url, seller_type, store_logo_url, store_banner_url, store_phone, store_whatsapp, store_telegram, store_instagram, store_facebook, store_website, store_hours, store_address, store_map_url")
    .eq("username", username)
    .maybeSingle()
  if (!profile || profile.is_suspended) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: listings }, { count: totalListingsCount }, { count: activeListingsCount }, favoritesResponse] = await Promise.all([
    supabase
      .from("listings_catalog")
      .select(listingSelect)
      .eq("status", "active")
      .eq("seller_username", username)
      .order("published_at", { ascending: false }),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", profile.id),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", profile.id).eq("status", "active"),
    user ? supabase.from("favorites").select("listing_id").eq("user_id", user.id) : Promise.resolve({ data: [] as { listing_id: string }[] }),
  ])

  const sellerListings = (listings ?? []) as CatalogListing[]
  const favoriteIds = new Set((favoritesResponse.data ?? []).map((item) => item.listing_id))
  const totalViews = sellerListings.reduce((sum, item) => sum + (item.views_count ?? 0), 0)
  const totalFavorites = sellerListings.reduce((sum, item) => sum + (item.favorites_count ?? 0), 0)
  const boostedListings = sellerListings.filter((item) => item.is_vip || item.is_promoted || item.is_featured).length
  const trustReasons = buildTrustReasons({
    isVerified: Boolean(profile.is_seller_verified),
    activeCount: activeListingsCount ?? 0,
    totalViews,
    totalFavorites,
    city: profile.city,
  })
  const sellerName = profile.full_name || profile.username
  const shareUrl = absoluteUrl(`/seller/${username}`)
  const sellerAvatarSrc = getUserAvatar(profile)
  const hasStoreDetails = profile.seller_type === "store" && Boolean(
    profile.store_phone ||
    profile.store_whatsapp ||
    profile.store_telegram ||
    profile.store_instagram ||
    profile.store_facebook ||
    profile.store_website ||
    profile.store_hours ||
    profile.store_address ||
    profile.store_map_url
  )
  const featuredListingHref = sellerListings[0]?.slug ? `/listing/${sellerListings[0].slug}` : "/catalog"

  return (
    <main className="min-h-screen bg-bg text-text">
      <SiteHeader />
      <section className="ui-container py-10 sm:py-14">
        <div className="overflow-hidden rounded-[1.25rem] border border-line bg-white shadow-[0_24px_90px_rgba(23,23,23,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(245,245,243,0.98),_rgba(232,243,239,0.95))] p-6 sm:p-8 lg:p-10">
              {profile.seller_type === "store" && profile.store_banner_url ? (
                <>
                  <div className="absolute inset-x-0 top-0 h-36 overflow-hidden border-b border-white/50 sm:h-44">
                    <SmartImage src={profile.store_banner_url} alt={sellerName} wrapperClassName="h-full w-full" className="object-cover" fallbackLabel="" loading="eager" />
                  </div>
                  <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/25 via-black/10 to-transparent sm:h-44" />
                </>
              ) : null}
              <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-white/80 blur-3xl" />
              <div className="absolute right-0 top-16 h-56 w-56 rounded-full bg-neutral-200/80 blur-3xl" />
              <div className={`relative z-10 ${profile.seller_type === "store" && profile.store_banner_url ? "pt-16 sm:pt-20" : ""}`}>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">{profile.seller_type === "store" ? "მაღაზიის პროფილი" : "გამყიდველის პროფილი"}</div>
                <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar src={sellerAvatarSrc} alt={sellerName} fallbackText={sellerName} sizeClassName="h-20 w-20" textClassName="text-2xl" className="shrink-0" />
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-3xl font-black tracking-tight text-text sm:text-4xl">{sellerName}</h1>
                        {profile.is_seller_verified ? <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">დადასტურებული პროფილი</span> : null}
                      </div>
                      <div className="mt-2 text-sm text-text-soft">@{profile.username} • {sellerTypeLabel(profile.seller_type)} • ჩვენთან არის {formatJoinDate(profile.created_at)}</div>
                    </div>
                  </div>
                  <ShareButton url={shareUrl} title={sellerName} text={`ნახე ${sellerName} ${profile.seller_type === "store" ? "მაღაზიის" : "გამყიდველის"} საჯარო პროფილი ${SITE_NAME}-ზე`} />
                </div>

                <p className="mt-6 max-w-3xl whitespace-pre-wrap text-base leading-7 text-text-soft sm:text-lg sm:leading-8">
                  {profile.bio || (profile.seller_type === "store" ? "მაღაზიას აღწერა ჯერ არ შეუვსია, მაგრამ ქვემოთ შეგიძლია ნახო აქტიური განცხადებები და საკონტაქტო ინფორმაცია." : "პროფილის აღწერა ჯერ არ არის შევსებული, მაგრამ ქვემოთ შეგიძლია გადაათვალიერო ყველა აქტიური განცხადება და ნდობის სიგნალი.")}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full border border-line bg-white/85 px-4 py-2 text-sm font-semibold text-text-soft">ქალაქი: {profile.city || "არ არის მითითებული"}</span>
                  <span className="rounded-full border border-line bg-white/85 px-4 py-2 text-sm font-semibold text-text-soft">აქტიური განცხადებები: {activeListingsCount ?? 0}</span>
                  <span className="rounded-full border border-line bg-white/85 px-4 py-2 text-sm font-semibold text-text-soft">ტიპი: {sellerTypeLabel(profile.seller_type)}</span>
                  <span className="rounded-full border border-line bg-white/85 px-4 py-2 text-sm font-semibold text-text-soft">VIP განცხადებები: {boostedListings}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 bg-brand px-6 py-7 text-white lg:border-l lg:border-t-0 lg:px-8 lg:py-10">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">ნდობა და სიგნალები</div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {[
                  { label: "სულ განცხადებები", value: totalListingsCount ?? 0 },
                  { label: "აქტიური განცხადებები", value: activeListingsCount ?? 0 },
                  { label: "ჯამური ნახვები", value: totalViews },
                  { label: "ფავორიტები", value: totalFavorites },
                  { label: "VIP", value: boostedListings },
                  { label: "ტიპი", value: sellerTypeLabel(profile.seller_type) },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/55">{item.label}</div>
                    <div className="mt-2 text-2xl font-black text-white">{item.value}</div>
                  </div>
                ))}
              </div>

              {trustReasons.length > 0 ? (
                <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">რატომ ენდობიან</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {trustReasons.map((reason) => (
                      <span key={reason} className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white">{reason}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/catalog" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-text transition hover:opacity-90">
                  კატალოგის ნახვა
                </Link>
                {profile.city ? (
                  <Link href={`/catalog?city=${encodeURIComponent(profile.city)}`} className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                    {profile.city}-ის შეთავაზებები
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className={`grid gap-6 ${hasStoreDetails ? "lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start" : ""}`}>
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">აქტიური შეთავაზებები</div>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">{profile.seller_type === "store" ? "მაღაზიის მიმდინარე განცხადებები" : "გამყიდველის მიმდინარე განცხადებები"}</h2>
              </div>
              <Link href="/catalog" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-text-soft">კატალოგში დაბრუნება</Link>
            </div>

            {sellerListings.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-6">
                {sellerListings.map((item) => (
                  <CatalogListingCard key={item.id} item={item} currentPath={`/seller/${username}`} isFavorited={favoriteIds.has(item.id)} />
                ))}
              </div>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-line bg-white p-8 text-text-soft shadow-sm">
                ამ პროფილს ჯერ აქტიური განცხადებები არ აქვს.
              </div>
            )}
          </div>

          {hasStoreDetails ? (
            <aside>
              <StorefrontPanels
                variant="sidebar"
                sellerName={sellerName}
                primaryListingHref={featuredListingHref}
                phone={profile.store_phone}
                whatsapp={profile.store_whatsapp}
                telegram={profile.store_telegram}
                instagram={profile.store_instagram}
                facebook={profile.store_facebook}
                website={profile.store_website}
                hours={profile.store_hours}
                address={profile.store_address}
                mapUrl={profile.store_map_url}
              />
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  )
}
