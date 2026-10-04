import RecentlyViewedRail from "@/components/listings/RecentlyViewedRail"
import RecommendedForYouRail from "@/components/listings/RecommendedForYouRail"
import AdCarousel from "@/components/ads/AdCarousel"
import HomeCollectionsSection from "@/components/home/HomeCollectionsSection"
import HomeHowItWorks from "@/components/home/HomeHowItWorks"
import HomeMarketplaceEmptyState from "@/components/home/HomeMarketplaceEmptyState"
import HomeProductsSection from "@/components/home/HomeProductsSection"
import HomePromoBanner from "@/components/home/HomePromoBanner"
import HomeSearchHeroSection from "@/components/home/HomeSearchHeroSection"
import HomeStoriesSlot from "@/components/home/HomeStoriesSlot"
import { ka } from "@/lib/i18n/ka"
import type { PublicHomePageData } from "@/lib/home-page"
import type { AdRecord } from "@/lib/ads"

export default function HomePageContent({data,heroAds=[]}:{data:PublicHomePageData;heroAds?:AdRecord[]}) {
 return <><HomeSearchHeroSection featuredItems={data.heroItems}/><HomeStoriesSlot/>
 <HomeProductsSection title="VIP განცხადებები" description="VIP და VIP MAX განცხადებები — გამორჩეული ბეჯით და მთავარი გვერდის სპეციალურ ჰორიზონტალურ სივრცეში." href="/catalog?vip=1&sort=vip" items={data.vipItems} favoriteIds={[]} layout="horizontal"/>
 {data.latestItems.length===0?<HomeMarketplaceEmptyState/>:null}
 <RecentlyViewedRail />
 <RecommendedForYouRail />
 <HomeProductsSection title={ka.home.latest} description={`${data.activeCount} აქტიური განცხადება SAMOSELL-ზე`} href="/catalog?sort=latest" items={data.latestItems} favoriteIds={[]}/>
 <HomePromoBanner bannerItems={data.bannerItems}/>
 <HomeProductsSection title={ka.home.popular} description="დალაგებულია რჩეულებისა და ნახვების რაოდენობის მიხედვით" href="/catalog?sort=popular" items={data.popularItems} favoriteIds={[]}/>
 <section aria-label="რეკლამა" className="border-b border-line bg-white py-8 sm:py-10"><div className="ui-container"><AdCarousel ads={heroAds} pagePath="/" fallbackPlacement="home_hero_left"/></div></section>
 <HomeProductsSection title={ka.home.affordable} description="აქტიური განცხადებები დალაგებულია ფასის ზრდის მიხედვით" href="/catalog?sort=price_asc" items={data.affordableItems} favoriteIds={[]}/>
 <HomeProductsSection title={ka.home.vintage} href="/catalog?category=vintage" items={data.vintageItems} favoriteIds={[]}/><HomeCollectionsSection brands={data.popularBrands}/><HomeHowItWorks/></>
}
