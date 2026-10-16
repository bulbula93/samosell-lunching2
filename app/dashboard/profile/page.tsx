import Link from "next/link"
import { redirect } from "next/navigation"
import ProfileForm from "@/components/dashboard/ProfileForm"
import UiPageHeader from "@/components/shared/UiPageHeader"
import { createClient } from "@/lib/supabase/server"
import { loadEditableProfile } from "@/lib/profile-editor-server"
import { getStoreSetupPath } from "@/lib/store-onboarding"

export default async function DashboardProfilePage({ searchParams }: { searchParams?: Promise<{ setup?: string | string[]; next?: string | string[] }> }) {
  const params = (await searchParams) ?? {}
  const setup = Array.isArray(params.setup) ? params.setup[0] : params.setup
  if (setup === "store") redirect(getStoreSetupPath(Array.isArray(params.next) ? params.next[0] : params.next))
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login?next=%2Fdashboard%2Fprofile")
  const profile = await loadEditableProfile(supabase, user.id)

  return (
    <main className="ui-page-shell">
      <div className="ui-page-container max-w-5xl">
        <UiPageHeader
          eyebrow="პროფილი"
          title="პროფილის რედაქტირება"
          description="განაახლე ის ინფორმაცია, რომელსაც მყიდველები და გამყიდველები შენს ანგარიშთან ერთად ხედავენ."
        />

      {profile?.username ? (
        <nav aria-label="გამომწერები და გამოწერები" className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href={`/seller/${encodeURIComponent(profile.username)}/followers`} className="ui-card p-5 transition hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-[0_16px_34px_rgba(7,63,59,0.08)] focus-visible:outline-2 focus-visible:outline-brand">
            <span className="block text-lg font-black text-brand">გამომწერები →</span>
            <span className="mt-1 block text-sm text-text-soft">ვინც შენ გამოგიწერა</span>
          </Link>
          <Link href={`/seller/${encodeURIComponent(profile.username)}/following`} className="ui-card p-5 transition hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-[0_16px_34px_rgba(7,63,59,0.08)] focus-visible:outline-2 focus-visible:outline-brand">
            <span className="block text-lg font-black text-brand">ჩემი გამოწერები →</span>
            <span className="mt-1 block text-sm text-text-soft">მომხმარებლები, რომლებსაც შენ იწერ</span>
          </Link>
        </nav>
      ) : null}

      <div className="mt-6">
        <ProfileForm
        userId={user.id}
        initialProfile={profile}
        />
      </div>
      </div>
    </main>
  )
}
