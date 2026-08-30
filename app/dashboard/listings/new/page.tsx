import CreateListingForm from "@/components/dashboard/CreateListingForm"
import ProfilePhoneRequiredCard from "@/components/dashboard/ProfilePhoneRequiredCard"
import { requireAuthenticatedUser } from "@/lib/auth"
import { isValidSellerPhone } from "@/lib/phone"

export default async function DashboardNewListingPage() {
  const { supabase, user } = await requireAuthenticatedUser("/dashboard/listings/new")
  const [categoriesResult, brandsResult, sizesResult, profileResult] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("id", { ascending: true }),
    supabase.from("brands").select("id, name").eq("is_active", true).order("name", { ascending: true }),
    supabase.from("sizes").select("id, label, group_name, sort_order").order("group_name", { ascending: true }).order("sort_order", { ascending: true }),
    supabase.from("profiles").select("store_phone").eq("id", user.id).maybeSingle(),
  ])

  if (categoriesResult.error || brandsResult.error || sizesResult.error || profileResult.error) {
    throw new Error("Listing form lookups could not be loaded.")
  }

  const sellerPhone = profileResult.data?.store_phone ?? ""

  return (
    <main className="min-h-screen bg-bg px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      {!isValidSellerPhone(sellerPhone) ? (
        <ProfilePhoneRequiredCard />
      ) : (
        <>
          <style>{`section[aria-labelledby$="-contact-heading"] { display: none; }`}</style>
          <CreateListingForm
            categories={categoriesResult.data ?? []}
            brands={brandsResult.data ?? []}
            sizes={sizesResult.data ?? []}
            initialSellerPhone={sellerPhone}
          />
        </>
      )}
    </main>
  )
}
