import type { Metadata } from "next"
import { cache } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import AdSlotRow from "@/components/ads/AdSlotRow"
import SiteHeader from "@/components/layout/SiteHeader"
import CatalogListingCard from "@/components/listings/CatalogListingCard"
import SellerReviewsSection from "@/components/reviews/SellerReviewsSection"
import Avatar from "@/components/shared/Avatar"
import ShareButton from "@/components/shared/ShareButton"
import SmartImage from "@/components/shared/SmartImage"
import FollowButton from "@/components/stories/FollowButton"
import StoryRingAvatar from "@/components/stories/StoryRingAvatar"
import ProfileChatButton from "@/components/sellers/ProfileChatButton"
import SellerActionIcon from "@/components/sellers/SellerActionIcon"
import StorefrontPanels from "@/components/shared/StorefrontPanels"
import TikTokLiveBadge from "@/components/shared/TikTokLiveBadge"
import { getUserAvatar, sellerTypeLabel } from "@/lib/profiles"
import { normalizeSellerUsernameParam } from "@/lib/seller-username"
import { fetchSellerReviewData } from "@/lib/reviews"
import { absoluteUrl, serializeJsonLd, truncateDescription } from "@/lib/seo"
import { formatSellerTenure, getSellerTrustSignals } from "@/lib/seller-trust"
import { SITE_NAME } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"
import { getFollowSummary, hasActiveStory } from "@/lib/story-data"
import type { CatalogListing } from "@/types/marketplace"

const listingSelect =
  "id, seller_id, slug, title, description, price, currency, sale_type, condition, city, material, color, gender, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, seller_type, seller_avatar_url, seller_store_logo_url, cover_image_url, published_at, favorites_count, views_count, status"

type PublicSellerListingCounts = {
  active_count?: number | string | null
  sold_count?: number | string | null
}

const fetchSeller = cache(async (username: string) => {
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, bio, city, is_seller_verified, is_suspended, created_at, avatar_url, seller_type, store_logo_url, store_banner_url, store_phone, store_whatsapp, store_telegram, store_instagram, store_facebook, store_website, store_hours, store_address, store_map_url, tiktok_username, tiktok_live_until")
    .eq("username", username)
    .maybeSingle()
  if (error) {
    console.error("[seller profile] lookup failed", { code: error.code })
    throw new Error("SELLER_PROFILE_LOOKUP_FAILED", { cause: error })
  }
  if (!profile || profile.is_suspended) return null
  return profile
})

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username: rawUsername } = await params
  const username = normalizeSellerUsernameParam(rawUsername)
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
  const { username: rawUsername } = await params
  const username = normalizeSellerUsernameParam(rawUsername)
  const supabase = await createClient()
  const profile = await fetchSeller(username)
  if (!profile || profile.is_suspended) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: listings }, sellerCountsResponse, favoritesResponse, sellerReviewData, followSummary, sellerHasStory] = await Promise.all([
    supabase
      .from("listings_catalog")
      .select(listingSelect)
      .eq("status", "active")
      .eq("seller_username", username)
      .order("published_at", { ascending: false }),
    supabase
      .rpc("get_public_seller_listing_counts", { p_seller_id: profile.id })
      .maybeSingle(),
    user
      ? supabase.from("favorites").select("listing_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { listing_id: string }[] }),
    fetchSellerReviewData(supabase, profile.id, { limit: 8 }),
    getFollowSummary(supabase, profile.id, user?.id),
    hasActiveStory(supabase, profile.id),
  ])

  if (sellerCountsResponse.error) {
    throw new Error("SELLER_TRUST_STATS_FAILED", { cause: sellerCountsResponse.error })
  }

  const sellerCounts = (sellerCountsResponse.data ?? null) as PublicSellerListingCounts | null
  const sellerListings = (listings ?? []) as CatalogListing[]
  const latestListings = sellerListings.slice(0, 8)
  const favoriteIds = new Set((favoritesResponse.data ?? []).map((item) => item.listing_id))
  const activeListingsCount = Number(sellerCounts?.active_count ?? 0)
  const soldListingsCount = Number(sellerCounts?.sold_count ?? 0)
  const trustSignals = getSellerTrustSignals({
    profile,
    soldListingsCount,
    reviewSummary: sellerReviewData.summary,
  })
  const displayTrustSignals = trustSignals.filter((signal) => signal.key !== "reviews" && signal.key !== "tenure")
  const sellerName = profile.full_name || profile.username
  const shareUrl = absoluteUrl(`/seller/${encodeURIComponent(profile.username)}`)
  const sellerAvatarSrc = getUserAvatar(profile)
  const storyOwner = { id: profile.id, username: profile.username, fullName: profile.full_name, avatarUrl: sellerAvatarSrc, storyCount: 1, unseenCount: 1, latestStoryAt: new Date().toISOString() }
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
  const sellerDescription = truncateDescription(
    profile.bio || `${sellerName} სელერის საჯარო პროფილი ${SITE_NAME}-ზე.`,
    155,
  )
  const sellerImage = sellerAvatarSrc
    ? sellerAvatarSrc.startsWith("/")
      ? absoluteUrl(sellerAvatarSrc)
      : sellerAvatarSrc
    : null
  const sellerEntityId = `${shareUrl}#seller`
  const sellerSameAs = [
    profile.store_website,
    profile.store_instagram,
    profile.store_facebook,
    profile.tiktok_username ? `https://www.tiktok.com/@${profile.tiktok_username}` : null,
  ].filter((value): value is string => Boolean(value && /^https?:\/\//i.test(value)))
  const sellerStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": `${shareUrl}#profilepage`,
        url: shareUrl,
        name: `${sellerName} — ${SITE_NAME} სელერი`,
        description: sellerDescription,
        inLanguage: "ka-GE",
        mainEntity: { "@id": sellerEntityId },
      },
      {
        "@type": profile.seller_type === "store" ? "Organization" : "Person",
        "@id": sellerEntityId,
        name: sellerName,
        url: shareUrl,
        description: sellerDescription,
        ...(sellerImage ? { image: sellerImage } : {}),
        ...(profile.city
          ? {
              address: {
                "@type": "PostalAddress",
                addressLocality: profile.city,
                addressCountry: "GE",
              },
            }
          : {}),
        ...(sellerSameAs.length > 0 ? { sameAs: sellerSameAs } : {}),
      },
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
            name: sellerName,
            item: shareUrl,
          },
        ],
      },
    ],
  }

  return (
    <main className="min-h-screen bg-[#fcfaf7] text-text">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(sellerStructuredData) }}
      />
      <SiteHeader />
      <section className="ui-container py-7 sm:py-12">
        <div className="overflow-hidden rounded-[1.75rem] border border-[#f0e4d9] bg-white shadow-[0_18px_60px_rgba(71,47,28,0.07)]">
          <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="relative min-w-0 bg-gradient-to-br from-white via-[#fffaf6] to-[#fff2e5] p-5 sm:p-8 lg:p-9">
              {profile.seller_type === "store" && profile.store_banner_url ? (
                <>
                  <div className="absolute inset-x-0 top-0 h-32 overflow-hidden sm:h-40">
                    <SmartImage src={profile.store_banner_url} alt={sellerName} wrapperClassName="h-full w-full" className="object-cover" fallbackLabel="" loading="eager" />
                  </div>
                  <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/20 to-transparent sm:h-40" />
                </>
              ) : null}

              <div className={`relative ${profile.seller_type === "store" && profile.store_banner_url ? "pt-24 sm:pt-32" : ""}`}>
                <p className="text-xs font-semibold text-text-soft">
                  {profile.seller_type === "store" ? "მაღაზიის პროფილი" : "გამყიდველის პროფილი"}
                </p>

                <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="relative shrink-0">
                      {sellerHasStory ? (
                        <StoryRingAvatar owner={storyOwner} currentUserId={user?.id ?? null} />
                      ) : (
                        <Avatar src={sellerAvatarSrc} alt={sellerName} fallbackText={sellerName} sizeClassName="h-20 w-20 sm:h-24 sm:w-24" textClassName="text-2xl" className="shrink-0" />
                      )}
                      <TikTokLiveBadge username={profile.tiktok_username} liveUntil={profile.tiktok_live_until} className="absolute -bottom-2 left-1/2 z-20 -translate-x-1/2" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="min-w-0 break-words text-2xl font-black tracking-tight text-[#073f3b] sm:text-3xl">{sellerName}</h1>
                        {profile.is_seller_verified ? (
                          <span className="rounded-full border border-[#fbd3b2] bg-[#fff2e5] px-2.5 py-1 text-[11px] font-semibold text-[#9f4600]">დადასტურებული</span>
                        ) : null}
                      </div>
                      <p className="mt-1 break-all text-xs text-text-soft">@{profile.username}</p>
                    </div>
                  </div>

                </div>

                <div
                  aria-label="გამყიდველის მოქმედებები"
                  className={`mt-5 grid w-full min-w-0 gap-1.5 sm:gap-2 ${user?.id === profile.id ? "max-w-44 grid-cols-1" : "grid-cols-3"}`}
                >
                  {user?.id !== profile.id ? (
                    user && !user.is_anonymous ? (
                      <FollowButton userId={profile.id} initialFollowing={followSummary.isFollowing} variant="profile" />
                    ) : (
                      <Link
                        href={`/login?next=${encodeURIComponent(`/seller/${username}`)}`}
                        className="flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-xl bg-[#075a53] px-1.5 text-[11px] font-bold text-white transition hover:bg-[#064a45] sm:gap-2 sm:px-3 sm:text-sm"
                      >
                        <SellerActionIcon name="follow" />
                        <span className="min-w-0 truncate">გამოწერა</span>
                      </Link>
                    )
                  ) : null}
                  {user?.id !== profile.id ? (
                    user && !user.is_anonymous ? (
                      <ProfileChatButton userId={profile.id} variant="profile" />
                    ) : (
                      <Link
                        href={`/login?next=${encodeURIComponent(`/seller/${username}`)}`}
                        className="flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-xl border border-[#b8d9d2] bg-white px-1.5 text-[11px] font-bold text-[#075a53] transition hover:bg-[#eff8f6] sm:gap-2 sm:px-3 sm:text-sm"
                      >
                        <SellerActionIcon name="chat" />
                        <span className="min-w-0 truncate">ჩათი</span>
                      </Link>
                    )
                  ) : null}
                  <ShareButton variant="profile" url={shareUrl} title={sellerName} text={`ნახე ${sellerName} ${SITE_NAME}-ზე`} />
                </div>

                {profile.bio ? (
                  <div className="mt-5 text-sm leading-6 text-text-soft sm:text-base sm:leading-7">
                    {profile.bio.length > 155 ? (
                      <details className="group">
                        <summary className="cursor-pointer list-none">
                          <span>{profile.bio.slice(0, 150).trimEnd()}…</span>
                          <span className="ml-2 font-semibold text-[#aa4a00] underline underline-offset-2">სრულად</span>
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap">{profile.bio}</p>
                      </details>
                    ) : <p className="whitespace-pre-wrap">{profile.bio}</p>}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-2.5">
                  {profile.city ? (
                    <span className="rounded-full border border-[#e1ece8] bg-white/90 px-3.5 py-2 text-sm font-medium text-[#073f3b]">{profile.city}</span>
                  ) : null}
                  <span className="rounded-full border border-[#f7e2cf] bg-[#fff3e6] px-3.5 py-2 text-sm font-medium text-[#89400a]">{sellerTypeLabel(profile.seller_type)}</span>
                  {followSummary.followers > 0 ? (
                    <Link href={`/seller/${encodeURIComponent(username)}/followers`} className="rounded-full border border-[#e1ece8] bg-white/90 px-3.5 py-2 text-sm font-medium text-[#073f3b] hover:border-[#075a53]/40">
                      {followSummary.followers} გამომწერი
                    </Link>
                  ) : null}
                </div>

                <section aria-label="გამყიდველის ნივთები" className="mt-8 border-t border-[#e9e5df] pt-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-[#073f3b]">ბოლოს დამატებული</h2>
                    {sellerListings.length > 1 ? (
                      <a href="#seller-listings" className="shrink-0 text-sm font-semibold text-[#af4c00] hover:underline">ყველა ნივთი →</a>
                    ) : null}
                  </div>
                  {latestListings.length > 0 ? (
                    <>
                      <Link href={`/listing/${latestListings[0].slug}`} className="group flex min-w-0 items-center gap-4 rounded-2xl border border-[#efe5dc] bg-white p-3 shadow-[0_10px_24px_rgba(65,47,33,0.04)] transition hover:border-[#ffbf8f] hover:shadow-md sm:gap-5 sm:p-4">
                        <div className="w-28 shrink-0 overflow-hidden rounded-xl bg-[#f6f0eb] sm:w-36">
                          <div className="aspect-[3/4]">
                            <SmartImage src={latestListings[0].cover_image_url} alt={latestListings[0].title} wrapperClassName="h-full w-full" className="object-cover transition-transform motion-safe:group-hover:scale-105" fallbackLabel="ფოტო არ არის" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 text-sm font-bold leading-6 text-[#073f3b] sm:text-base">{latestListings[0].title}</h3>
                          <p className="mt-2 text-xl font-black text-[#075a53]">{latestListings[0].price} {latestListings[0].currency === "GEL" ? "₾" : latestListings[0].currency}</p>
                          {latestListings[0].city ? <p className="mt-2 text-xs text-text-soft">{latestListings[0].city}</p> : null}
                          <span className="mt-3 inline-block text-sm font-semibold text-[#bd5400]">ნახვა →</span>
                        </div>
                      </Link>
                      {latestListings.length > 1 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {latestListings.slice(1, 4).map((item) => (
                            <Link key={item.id} href={`/listing/${item.slug}`} className="max-w-full truncate rounded-full border border-[#ecd9c8] bg-white px-3.5 py-2 text-xs font-semibold text-text-soft hover:border-[#ffb57e]">
                              {item.title}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-[#eed9c7] bg-white/80 p-5 text-sm text-text-soft">განცხადებები ჯერ არ არის დამატებული.</p>
                  )}
                </section>
              </div>
            </div>

            <div className="min-w-0 border-t border-[#f0e4d9] bg-white p-5 sm:p-8 lg:border-l lg:border-t-0 lg:p-9">
              <div aria-hidden="true" className="mb-4 h-1.5 w-11 rounded-full bg-[#ff7a00]" />
              <h2 className="text-xl font-bold tracking-tight text-[#073f3b] sm:text-2xl">გამყიდველის შესახებ</h2>
              <p className="mt-1.5 text-sm text-text-soft">მოკლედ და გასაგებად</p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="min-w-0 rounded-2xl border border-[#ffe6d1] bg-[#fff5ec] p-4">
                  <p className="text-xl font-bold text-[#073f3b] sm:text-2xl">{activeListingsCount}</p>
                  <p className="mt-1 text-xs leading-5 text-text-soft">აქტიური განცხადება</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-[#d9ebe6] bg-[#eff8f6] p-4">
                  <p className="break-words text-lg font-bold text-[#073f3b] sm:text-xl">{formatSellerTenure(profile.created_at) || "—"}</p>
                  <p className="mt-1 text-xs leading-5 text-text-soft">SamoSell-ზე</p>
                </div>
              </div>

              <section aria-label="გამყიდველის შეფასებები" className="mt-4 rounded-2xl border border-[#efe5dc] bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-[#073f3b]">შეფასებები</h3>
                  <a href="#seller-reviews-heading" className="shrink-0 text-xs font-semibold text-[#aa4a00] hover:underline">ყველა →</a>
                </div>
                {sellerReviewData.summary.reviewCount > 0 && sellerReviewData.summary.averageScore !== null ? (
                  <p className="mt-3 flex flex-wrap items-baseline gap-2">
                    <span className="text-xl font-bold text-[#c35700]">★ {sellerReviewData.summary.averageScore.toFixed(1)}</span>
                    <span className="text-sm text-text-soft">{sellerReviewData.summary.reviewCount} შეფასება</span>
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-text-soft">შეფასებები ჯერ არ არის</p>
                )}
              </section>

              {displayTrustSignals.length > 0 ? (
                <section aria-label="სანდოობის ნიშნები" className="mt-6">
                  <h3 className="mb-3 text-base font-bold text-[#073f3b]">სანდოობის ნიშნები</h3>
                  <div className="flex flex-wrap gap-2">
                    {displayTrustSignals.map((signal) => (
                      <span
                        key={signal.key}
                        title={signal.detail}
                        className="rounded-full border border-[#e6e8e3] bg-[#f8faf8] px-3.5 py-2 text-xs font-semibold text-[#073f3b]"
                      >
                        {signal.label}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              <a href="#seller-listings" className="mt-7 flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#075a53] bg-[#075a53] px-5 py-3 text-center text-sm font-bold text-white shadow-[0_6px_18px_rgba(7,90,83,0.12)] transition-colors hover:border-[#064a45] hover:bg-[#064a45] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075a53]">
                განცხადებების ნახვა <span aria-hidden="true" className="text-[#ffb172]">→</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <AdSlotRow
        placementKeys={["profile_inline_left", "profile_inline_right"]}
        pagePath={`/seller/${username}`}
        className="pb-10 sm:pb-12"
      />

      <SellerReviewsSection data={sellerReviewData} />

      <section id="seller-listings" className="mx-auto max-w-7xl scroll-mt-40 px-4 pb-12 sm:px-6">
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
                phoneAvailable={Boolean(profile.store_phone)}
                sellerUsername={profile.username}
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
