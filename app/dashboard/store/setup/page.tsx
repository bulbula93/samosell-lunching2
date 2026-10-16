import type { Metadata } from "next"
import { redirect } from "next/navigation"
import ProfileForm from "@/components/dashboard/ProfileForm"
import { loadEditableProfile } from "@/lib/profile-editor-server"
import { getStoreSetupContinuePath, getStoreSetupPath } from "@/lib/store-onboarding"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "შექმენი შენი მაღაზია", robots: { index: false, follow: false } }

export default async function StoreSetupPage({ searchParams }: {
  searchParams?: Promise<{ next?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const continuePath = getStoreSetupContinuePath(Array.isArray(params.next) ? params.next[0] : params.next)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(getStoreSetupPath(continuePath))}`)

  const profile = await loadEditableProfile(supabase, user.id)
  return (
    <main className="ui-container pb-16 pt-9">
      <div className="mb-7 max-w-3xl">
        <p className="text-xs font-black text-[#b47b5d]">მაღაზიის რეგისტრაცია · შენი ვიტრინა</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand sm:text-4xl">შექმენი შენი მაღაზიის მთავარი ბლოკი</h1>
        <p className="mt-4 text-sm leading-7 text-text-soft">ანგარიში მზადაა — ახლა დაამატე მაღაზიის სახელი, ტექსტები, ქავერი და საკონტაქტო ინფორმაცია, ცვლილებებს წინასწარ ნახვაში მაშინვე დაინახავ</p>
      </div>
      <ProfileForm startStoreSetup userId={user.id} initialProfile={profile} continuePath={continuePath} />
    </main>
  )
}
