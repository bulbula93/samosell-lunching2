import SeoGuidePage from "@/components/seo/SeoGuidePage"
import { buildSeoGuideMetadata, SEO_GUIDES } from "@/lib/seo-guides"

const guide = SEO_GUIDES.whereToSell

export const metadata = buildSeoGuideMetadata(guide)

export default function WhereToSellClothesPage() {
  return <SeoGuidePage guide={guide} />
}
