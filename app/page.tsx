import type { Metadata } from "next"
import HomePageContent from "@/components/home/HomePageContent"
import { HomePersonalizationProvider } from "@/components/home/HomePersonalizationProvider"
import SiteHeader from "@/components/layout/SiteHeader"
import { getActiveAdRotation } from "@/lib/ad-data"
import { getPublicHomePageData, type PublicHomePageData } from "@/lib/home-page"
import { absoluteUrl, buildHomeStructuredData, serializeJsonLd } from "@/lib/seo"
import { SITE_DESCRIPTION_EN, SITE_DESCRIPTION_KA, SITE_NAME } from "@/lib/site"
import { isReadOnlyPreview } from "@/lib/preview-read-only"
import { homeClsProbe } from "@/lib/qa/home-cls-probe"

export const dynamic = "force-dynamic"
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

export default async function Home({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const audit = process.env.VERCEL_ENV === "preview" && isReadOnlyPreview()
    && (await searchParams)?._cls_audit === "1"
  const [catalogResult, adsResult] = await Promise.allSettled([
    getPublicHomePageData(),
    getActiveAdRotation(["home_hero_left", "home_hero_right"]),
  ])
  // Do not let a temporary PostgREST timeout turn the homepage into a 500.
  // A degraded response is request-scoped, not cached as an empty marketplace.
  const catalogUnavailable = catalogResult.status === "rejected"
  const data: PublicHomePageData = catalogResult.status === "fulfilled"
    ? catalogResult.value
    : {
        heroItems: [], vipItems: [], bannerItems: [], latestItems: [],
        popularItems: [], affordableItems: [], vintageItems: [],
        popularBrands: [], activeCount: 0,
      }
  const heroAds = adsResult.status === "fulfilled" ? adsResult.value : []
  if (catalogUnavailable) {
    console.warn("home_catalog_degraded", "public_catalog_temporarily_unavailable")
  }
  const structuredData = buildHomeStructuredData()

  return (
    <>
      {audit ? <script dangerouslySetInnerHTML={{ __html: homeClsProbe }} /> : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <SiteHeader />
      <HomePersonalizationProvider>
        <main className="min-h-screen bg-bg text-text">
          <HomePageContent data={data} heroAds={heroAds} catalogUnavailable={catalogUnavailable} />
        </main>
      </HomePersonalizationProvider>
    </>
  )
}
