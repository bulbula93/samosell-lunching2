import type { Metadata } from "next"
import { Suspense } from "react"
import HomePageContent from "@/components/home/HomePageContent"
import { HomePersonalizationProvider } from "@/components/home/HomePersonalizationProvider"
import HomeSiteHeader from "@/components/home/HomeSiteHeader"
import { getMarketplaceNavigationItems } from "@/components/layout/SiteHeader"
import { getActiveAdRotation } from "@/lib/ad-data"
import { getPublicHomePageData } from "@/lib/home-page"
import { absoluteUrl, buildHomeStructuredData, serializeJsonLd } from "@/lib/seo"
import { SITE_DESCRIPTION_KA, SITE_NAME } from "@/lib/site"

export const revalidate = 60

export const metadata: Metadata = {
  title: "მეორადი ტანსაცმლის ონლაინ მარკეტპლეისი საქართველოში",
  description: SITE_DESCRIPTION_KA,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME} — მეორადი ტანსაცმლის ონლაინ მარკეტპლეისი`,
    description: SITE_DESCRIPTION_KA,
    url: absoluteUrl("/"),
    type: "website",
    images: [{ url: absoluteUrl("/og-cover.png") }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — მეორადი ტანსაცმლის ონლაინ მარკეტპლეისი`,
    description: SITE_DESCRIPTION_KA,
    images: [absoluteUrl("/og-cover.png")],
  },
}

export default async function Home() {
  // Fail regeneration on a catalog outage: ISR retains the last good page.
  const [data, heroAds, navigation] = await Promise.all([
    getPublicHomePageData(),
    getActiveAdRotation(["home_hero_left", "home_hero_right"]),
    getMarketplaceNavigationItems(),
  ])
  const structuredData = buildHomeStructuredData()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <HomePersonalizationProvider>
        <Suspense fallback={<div className="h-[72px] border-b border-line bg-white" aria-hidden="true" />}><HomeSiteHeader items={navigation} /></Suspense>
        <main className="min-h-screen bg-bg text-text">
          <HomePageContent data={data} heroAds={heroAds} />
        </main>
      </HomePersonalizationProvider>
    </>
  )
}
