import Link from "next/link"
import ProfileForm from "@/components/dashboard/ProfileForm"
import UiPageHeader from "@/components/shared/UiPageHeader"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, bio, city, avatar_url, seller_type, store_logo_url, store_banner_url, store_phone, store_whatsapp, store_telegram, store_instagram, store_facebook, store_website, store_hours, store_address, store_map_url, tiktok_username, tiktok_live_until")
    .eq("id", user!.id)
    .maybeSingle()


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
        userId={user!.id}
        initialProfile={{
          username: profile?.username ?? "",
          full_name: profile?.full_name ?? "",
          bio: profile?.bio ?? "",
          city: profile?.city ?? "",
          avatar_url: profile?.avatar_url ?? "",
          seller_type: profile?.seller_type ?? "individual",
          store_logo_url: profile?.store_logo_url ?? "",
          store_banner_url: profile?.store_banner_url ?? "",
          store_phone: profile?.store_phone ?? "",
          store_whatsapp: profile?.store_whatsapp ?? "",
          store_telegram: profile?.store_telegram ?? "",
          store_instagram: profile?.store_instagram ?? "",
          store_facebook: profile?.store_facebook ?? "",
          store_website: profile?.store_website ?? "",
          store_hours: profile?.store_hours ?? "",
          store_address: profile?.store_address ?? "",
          store_map_url: profile?.store_map_url ?? "",
          tiktok_username: profile?.tiktok_username ?? "",
          tiktok_live_until: profile?.tiktok_live_until ?? "",
        }}
        />
      </div>
      </div>
    </main>
  )
}
