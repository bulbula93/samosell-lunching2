import SeoGuidePage from "@/components/seo/SeoGuidePage"
import { buildSeoGuideMetadata, SEO_GUIDES } from "@/lib/seo-guides"

const guide = SEO_GUIDES.sustainable

export const metadata = buildSeoGuideMetadata(guide)

export default function SustainableFashionPage() {
  return <SeoGuidePage guide={guide} />
}
