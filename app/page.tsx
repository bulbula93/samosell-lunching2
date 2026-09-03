import type { Metadata } from "next"
import HomePageContent from "@/components/home/HomePageContent"
import SiteHeader from "@/components/layout/SiteHeader"
import { getActiveAdsForPlacements } from "@/lib/ad-data"
import { getHomePageData } from "@/lib/home-page"
import { absoluteUrl, buildHomeStructuredData, serializeJsonLd } from "@/lib/seo"
import { SITE_DESCRIPTION_EN, SITE_DESCRIPTION_KA, SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: "მთავარი",
  description: SITE_DESCRIPTION_KA,
  alternates: { canonical: "/" },
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
  const [data, heroAds] = await Promise.all([
    getHomePageData(),
    getActiveAdsForPlacements(["home_hero_left", "home_hero_right"]),
  ])
  const structuredData = buildHomeStructuredData()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <SiteHeader authenticatedUser={data.user} />
      <main className="min-h-screen bg-bg text-text">
        <HomePageContent data={data} heroAds={heroAds} />
      </main>
    </>
  )
}
