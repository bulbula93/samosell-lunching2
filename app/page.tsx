import type { Metadata } from "next"
import { Suspense } from "react"
import HomePageContent from "@/components/home/HomePageContent"
import { HomePersonalizationProvider } from "@/components/home/HomePersonalizationProvider"
import HomeSiteHeader from "@/components/home/HomeSiteHeader"
import { getMarketplaceNavigationItems } from "@/components/layout/SiteHeader"
import { getActiveAdRotation } from "@/lib/ad-data"
import { getPublicHomePageData } from "@/lib/home-page"
import { absoluteUrl, buildHomeStructuredData, serializeJsonLd } from "@/lib/seo"
import { SITE_NAME } from "@/lib/site"

// Was 60s: every regeneration costs ~0.3s of CPU, so a busy homepage re-rendered up to
// 1,440x/day and alone used most of the Hobby Fluid CPU allowance. Listing create/edit/
// status/delete/moderation actions call revalidatePath("/"), so new items still appear
// immediately; the 10-minute window only bounds background refreshes.
export const revalidate = 600

// Home targets the head terms seen in Search Console: "ახალი/მეორადი ტანსაცმელი ონლაინ".
const HOME_TITLE = "ახალი და მეორადი ტანსაცმელი ონლაინ — იყიდე და გაყიდე საქართველოში"
const HOME_DESCRIPTION = "იყიდე და გაყიდე ახალი და მეორადი ტანსაცმელი, ფეხსაცმელი, ჩანთები და სუნამოები მთელ საქართველოში. განცხადება უფასოა, საკომისიო — 0%."

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME} — ახალი და მეორადი ტანსაცმელი ონლაინ`,
    description: HOME_DESCRIPTION,
    url: absoluteUrl("/"),
    type: "website",
    images: [{ url: absoluteUrl("/og-cover.png") }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ახალი და მეორადი ტანსაცმელი ონლაინ`,
    description: HOME_DESCRIPTION,
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
