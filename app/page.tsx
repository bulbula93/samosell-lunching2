import type { Metadata } from "next"
import HomeCollectionsSection from "@/components/home/HomeCollectionsSection"
import HomeHeader from "@/components/home/HomeHeader"
import HomeProductsSection from "@/components/home/HomeProductsSection"
import HomePromoBanner from "@/components/home/HomePromoBanner"
import HomeSearchHeroSection from "@/components/home/HomeSearchHeroSection"
import HomeSellIntroSection from "@/components/home/HomeSellIntroSection"
import { getHomePageData } from "@/lib/home-page"
import { absoluteUrl } from "@/lib/seo"
import { SITE_DESCRIPTION_EN, SITE_DESCRIPTION_KA, SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: "მთავარი",
  description: SITE_DESCRIPTION_KA,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION_EN,
    url: absoluteUrl("/"),
    type: "website",
    images: [{ url: absoluteUrl("/og-cover.png") }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION_EN,
    images: [absoluteUrl("/og-cover.png")],
  },
}

export default async function Home() {
  const {
    user,
    profileLabel,
    heroImages,
    showcaseImage,
    bannerItems,
    collections,
    latestSectionItems,
    vipSectionItems,
    activeCount,
    vipCount,
  } = await getHomePageData()

  return (
    <main className="min-h-screen bg-[#ECECEC] font-body text-[#2D2D2D]">
      <HomeHeader signedIn={Boolean(user)} profileLabel={profileLabel} />
      <HomeSearchHeroSection heroImages={heroImages} />
      <HomeSellIntroSection signedIn={Boolean(user)} showcaseImage={showcaseImage} />
      <HomePromoBanner bannerItems={bannerItems} />
      <HomeCollectionsSection collections={collections} />
      <HomeProductsSection title="ბოლოს დამატებული პროდუქტები" href="/catalog?sort=newest" count={activeCount} items={latestSectionItems} />
      <HomeProductsSection title="VIP პროდუქტები" href="/catalog?vip=1" count={vipCount} items={vipSectionItems} />
    </main>
  )
}
