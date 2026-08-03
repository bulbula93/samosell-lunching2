import CreateListingForm from "@/components/dashboard/CreateListingForm"
import { requireAuthenticatedUser } from "@/lib/auth"

export default async function DashboardNewListingPage() {
  const { supabase } = await requireAuthenticatedUser("/dashboard/listings/new")
  const [categoriesResult, brandsResult, sizesResult] = await Promise.all([
    supabase.from("categories").select("id, name").order("id", { ascending: true }),
    supabase.from("brands").select("id, name").eq("is_active", true).order("name", { ascending: true }),
    supabase.from("sizes").select("id, label").order("sort_order", { ascending: true }),
  ])

  if (categoriesResult.error || brandsResult.error || sizesResult.error) {
    throw new Error("Listing form lookups could not be loaded.")
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <CreateListingForm
        categories={categoriesResult.data ?? []}
        brands={brandsResult.data ?? []}
        sizes={sizesResult.data ?? []}
      />
    </main>
  )
}
