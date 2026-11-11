import Link from "next/link"
import AdCarousel from "@/components/ads/AdCarousel"
import HomeCollectionsSection from "@/components/home/HomeCollectionsSection"
import HomeHowItWorks from "@/components/home/HomeHowItWorks"
import HomeMarketplaceEmptyState from "@/components/home/HomeMarketplaceEmptyState"
import HomeProductsSection from "@/components/home/HomeProductsSection"
import HomePromoBanner from "@/components/home/HomePromoBanner"
import HomeSearchHeroSection from "@/components/home/HomeSearchHeroSection"
import { ka } from "@/lib/i18n/ka"
import type { PublicHomePageData } from "@/lib/home-page"
import type { AdRecord } from "@/lib/ads"

export default function HomePageContent({data,heroAds=[],catalogUnavailable=false}:{data:PublicHomePageData;heroAds?:AdRecord[];catalogUnavailable?:boolean}) {
 return <><HomeSearchHeroSection featuredItems={data.heroItems}/>{catalogUnavailable ? <section role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-4 text-center text-sm text-amber-900"><p>განცხადებების ნაწილი დროებით ვერ ჩაიტვირთა. შეგიძლიათ გახსნათ <Link href="/catalog" className="font-semibold underline underline-offset-4">კატალოგი</Link> ან განაახლოთ გვერდი მოგვიანებით.</p></section> : null}<AdCarousel ads={heroAds} pagePath="/"/>
 {data.vipItems.length > 0 ? <HomeProductsSection title="VIP განცხადებები" description="VIP და VIP MAX განცხადებები — გამორჩეული ბეჯით და მთავარი გვერდის სპეციალურ ჰორიზონტალურ სივრცეში." href="/catalog?vip=1&sort=vip" items={data.vipItems} favoriteIds={[]} layout="horizontal" promotionOnly/> : null}
 {!catalogUnavailable&&data.latestItems.length===0?<HomeMarketplaceEmptyState/>:null}
 {!catalogUnavailable?<HomeProductsSection title={ka.home.latest} href="/catalog?sort=latest" items={data.latestItems} favoriteIds={[]} mobileLimit={6}/>:null}
 <HomePromoBanner bannerItems={data.bannerItems}/>
 <HomeProductsSection title={ka.home.popular} description="დალაგებულია რჩეულებისა და ნახვების რაოდენობის მიხედვით" href="/catalog?sort=popular" items={data.popularItems} favoriteIds={[]} layout="rail"/>
 <HomeProductsSection title={ka.home.affordable} description="აქტიური განცხადებები დალაგებულია ფასის ზრდის მიხედვით" href="/catalog?sort=price_asc" items={data.affordableItems} favoriteIds={[]} layout="rail"/>
 <HomeProductsSection title={ka.home.vintage} href="/catalog/vintage" items={data.vintageItems} favoriteIds={[]} layout="rail"/><HomeCollectionsSection brands={data.popularBrands}/><HomeHowItWorks/></>
}
