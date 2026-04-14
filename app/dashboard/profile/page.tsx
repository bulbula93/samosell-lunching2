import ProfileForm from "@/components/dashboard/ProfileForm"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, bio, city, avatar_url, seller_type, store_logo_url, store_banner_url, store_phone, store_whatsapp, store_telegram, store_instagram, store_facebook, store_website, store_hours, store_address, store_map_url")
    .eq("id", user!.id)
    .maybeSingle()

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">პროფილი</div>
        <h1 className="mt-3 text-4xl font-black">პროფილის რედაქტირება</h1>
        <p className="mt-3 max-w-2xl text-neutral-600">განაახლე ის ინფორმაცია, რომელსაც მყიდველები და გამყიდველები შენს ანგარიშთან ერთად ხედავენ.</p>
      </div>

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
        }}
      />
    </main>
  )
}
