import type { Metadata } from "next"
import SiteHeader from "@/components/layout/SiteHeader"
import StoreHeroEditorDemo from "@/components/stores/StoreHeroEditorDemo"

export const metadata: Metadata = { title: "შექმენი მაღაზიის ვიტრინა · დემო", robots: { index: false, follow: false } }

export default function StoreHeroEditorDemoPage() {
  return <><SiteHeader /><main className="min-h-screen bg-bg"><StoreHeroEditorDemo /></main></>
}
