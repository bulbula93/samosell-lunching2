import SeoGuidePage from "@/components/seo/SeoGuidePage"
import { buildSeoGuideMetadata, SEO_GUIDES } from "@/lib/seo-guides"

const guide = SEO_GUIDES.vintage

export const metadata = buildSeoGuideMetadata(guide)

export default function VintageGeorgiaPage() {
  return <SeoGuidePage guide={guide} />
}
