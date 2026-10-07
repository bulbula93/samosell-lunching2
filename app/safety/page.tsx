import SeoGuidePage from "@/components/seo/SeoGuidePage"
import { buildSeoGuideMetadata, SEO_GUIDES } from "@/lib/seo-guides"

const guide = SEO_GUIDES.safety

export const metadata = buildSeoGuideMetadata(guide)

export default function SafetyPage() {
  return <SeoGuidePage guide={guide} />
}
