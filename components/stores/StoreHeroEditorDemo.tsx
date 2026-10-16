"use client"

import Link from "next/link"
import ProfileForm from "@/components/dashboard/ProfileForm"
import { EMPTY_EDITABLE_PROFILE } from "@/lib/profile-editor"
import { STORE_SETUP_PATH } from "@/lib/store-onboarding"

export default function StoreHeroEditorDemo() {
  return (
    <div className="ui-container pb-16 pt-9">
      <div className="mb-7 max-w-3xl">
        <p className="text-xs font-black text-[#b47b5d]">მაღაზიის ვიტრინის კონსტრუქტორი · დემო</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand sm:text-4xl">შექმენი შენი მაღაზიის მთავარი ბლოკი</h1>
        <p className="mt-4 text-sm leading-7 text-text-soft">ასე გააგრძელებ მაღაზიის რეგისტრაციას ანგარიშის შექმნის შემდეგ — აქ შეგიძლია მოსინჯო ტექსტები და ფოტოები, ცვლილებები სერვერზე არ ინახება</p>
        <Link href={`/register?next=${encodeURIComponent(STORE_SETUP_PATH)}`} className="ui-btn-primary mt-4 inline-flex">დაიწყე მაღაზიის რეგისტრაცია ↗</Link>
      </div>
      <ProfileForm startStoreSetup previewOnly userId="" initialProfile={{
        ...EMPTY_EDITABLE_PROFILE,
        full_name: "ჩემი მაღაზია", username: "my_shop", city: "თბილისი", seller_type: "store",
        store_instagram: "@samo.sell", store_banner_url: "/brand/samosell-shops-boutique.webp",
        store_hero: {
          eyebrow: "ვინტაჟური სამოსი · თბილისი",
          headline: "სტილი, რომელსაც თავისი ისტორია აქვს",
          description: "შერჩეული სამოსი და აქსესუარები ახალი აღმოჩენებისთვის",
          coverTitle: "შენი შემდეგი რჩეული", coverSubtitle: "შერჩეული ნივთები",
        },
      }} />
    </div>
  )
}
