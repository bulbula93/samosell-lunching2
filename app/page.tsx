import type { Metadata } from "next"
import HomePageContent from "@/components/home/HomePageContent"
import { HomePersonalizationProvider } from "@/components/home/HomePersonalizationProvider"
import HomeSiteHeader from "@/components/home/HomeSiteHeader"
import { getMarketplaceNavigationItems } from "@/components/layout/SiteHeader"
import { getActiveAdsForPlacements } from "@/lib/ad-data"
import { getPublicHomePageData } from "@/lib/home-page"
import { absoluteUrl, buildHomeStructuredData, serializeJsonLd } from "@/lib/seo"
import { SITE_DESCRIPTION_EN, SITE_DESCRIPTION_KA, SITE_NAME } from "@/lib/site"

export const revalidate = 60

export const metadata: Metadata = {
  title: "მეორადი ტანსაცმლის ონლაინ მარკეტპლეისი საქართველოში",
  description: SITE_DESCRIPTION_KA,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME} — მეორადი ტანსაცმლის ონლაინ მარკეტპლეისი`,
    description: SITE_DESCRIPTION_EN,
    url: absoluteUrl("/"),
    type: "website",
    images: [{ url: absoluteUrl("/og-cover.png") }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — მეორადი ტანსაცმლის ონლაინ მარკეტპლეისი`,
    description: SITE_DESCRIPTION_EN,
    images: [absoluteUrl("/og-cover.png")],
  },
}

export default async function Home() {
  const [data, heroAds, navigationItems] = await Promise.all([
    getPublicHomePageData(),
    getActiveAdsForPlacements(["home_hero_left", "home_hero_right"]),
    getMarketplaceNavigationItems(),
  ])
  const structuredData = buildHomeStructuredData()

  return (
    <HomePersonalizationProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <HomeSiteHeader items={navigationItems} />
      <main className="min-h-screen bg-bg text-text">
        <HomePageContent data={data} heroAds={heroAds} />
      </main>
    </HomePersonalizationProvider>
  )
}
