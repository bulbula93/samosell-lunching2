import AdSlotRow from "@/components/ads/AdSlotRow"
import HomeCollectionsSection from "@/components/home/HomeCollectionsSection"
import HomeHowItWorks from "@/components/home/HomeHowItWorks"
import HomeMarketplaceEmptyState from "@/components/home/HomeMarketplaceEmptyState"
import HomeProductsSection from "@/components/home/HomeProductsSection"
import HomePromoBanner from "@/components/home/HomePromoBanner"
import HomeSearchHeroSection from "@/components/home/HomeSearchHeroSection"
import { ka } from "@/lib/i18n/ka"
import type { HomePageData } from "@/lib/home-page"
import type { AdsByPlacement } from "@/lib/ads"

export default function HomePageContent({
  data,
  heroAds = {},
}: {
  data: HomePageData
  heroAds?: AdsByPlacement
}) {
  return (
    <>
      <HomeSearchHeroSection vipItems={data.heroItems} popularItems={data.popularItems} />
      <AdSlotRow
        placementKeys={["home_hero_left", "home_hero_right"]}
        pagePath="/"
        className="border-b border-line bg-white py-8 sm:py-10"
        ads={heroAds}
      />
      {data.latestItems.length === 0 ? <HomeMarketplaceEmptyState /> : null}
      <HomeProductsSection
        title={ka.home.latest}
        description={`${data.activeCount} აქტიური განცხადება SAMOSELL-ზე`}
        href="/catalog?sort=latest"
        items={data.latestItems}
        favoriteIds={data.favoriteIds}
      />
      {data.featuredItems.length > 0 ? (
        <HomeProductsSection
          title="VIP MAX"
          description="მთავარი გვერდის გამორჩეული განცხადებები"
          href="/catalog?sort=vip"
          items={data.featuredItems}
          favoriteIds={data.favoriteIds}
        />
      ) : null}
      <HomeProductsSection
        title={ka.home.popular}
        description="დალაგებულია რჩეულებისა და ნახვების რაოდენობის მიხედვით"
        href="/catalog?sort=popular"
        items={data.popularItems}
        favoriteIds={data.favoriteIds}
      />
      <HomePromoBanner bannerItems={data.bannerItems} />
      <HomeProductsSection
        title={ka.home.affordable}
        description="აქტიური განცხადებები დალაგებულია ფასის ზრდის მიხედვით"
        href="/catalog?sort=price_asc"
        items={data.affordableItems}
        favoriteIds={data.favoriteIds}
      />
      <HomeProductsSection
        title={ka.home.vintage}
        href="/catalog?category=vintage"
        items={data.vintageItems}
        favoriteIds={data.favoriteIds}
      />
      <HomeCollectionsSection brands={data.popularBrands} />
      <HomeHowItWorks />
    </>
  )
}
