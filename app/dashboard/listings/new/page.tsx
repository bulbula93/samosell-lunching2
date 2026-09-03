import AdSlotRow from "@/components/ads/AdSlotRow"
import CreateListingWizard from "@/components/dashboard/CreateListingWizard"
import ProfileCompletionIndicator from "@/components/dashboard/ProfileCompletionIndicator"
import ProfilePhoneRequiredCard from "@/components/dashboard/ProfilePhoneRequiredCard"
import { requireAuthenticatedUser } from "@/lib/auth"
import { getProfileCompletion } from "@/lib/profile-completion"

export default async function DashboardNewListingPage() {
  const { supabase, user } = await requireAuthenticatedUser("/dashboard/listings/new")
  const [categoriesResult, brandsResult, sizesResult, profileResult] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("id", { ascending: true }),
    supabase.from("brands").select("id, name").eq("is_active", true).order("name", { ascending: true }),
    supabase.from("sizes").select("id, label, group_name, sort_order").order("group_name", { ascending: true }).order("sort_order", { ascending: true }),
    supabase
      .from("profiles")
      .select("full_name, city, avatar_url, seller_type, store_logo_url, store_phone")
      .eq("id", user.id)
      .maybeSingle(),
  ])

  if (categoriesResult.error || brandsResult.error || sizesResult.error || profileResult.error) {
    throw new Error("Listing form lookups could not be loaded.")
  }

  const profile = profileResult.data
  const completion = getProfileCompletion({
    full_name: profile?.full_name,
    city: profile?.city,
    avatar_url: profile?.avatar_url,
    seller_type: profile?.seller_type,
    store_logo_url: profile?.store_logo_url,
    store_phone: profile?.store_phone,
  })
  const sellerPhone = profile?.store_phone ?? ""

  return (
    <main className="min-h-screen bg-bg px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <ProfileCompletionIndicator completion={completion} context="listing" />

        {!completion.canPublishListing ? (
          <ProfilePhoneRequiredCard />
        ) : (
          <CreateListingWizard
            categories={categoriesResult.data ?? []}
            brands={brandsResult.data ?? []}
            sizes={sizesResult.data ?? []}
            initialSellerPhone={sellerPhone}
          />
        )}

        <AdSlotRow
          placementKeys={["sell_bottom_left", "sell_bottom_right"]}
          pagePath="/dashboard/listings/new"
          className="pt-4"
          contained={false}
        />
      </div>
    </main>
  )
}
