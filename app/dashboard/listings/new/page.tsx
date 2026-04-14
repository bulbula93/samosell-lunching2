import CreateListingForm from "@/components/dashboard/CreateListingForm"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardNewListingPage() {
  const supabase = await createClient()
  const [{ data: categories }, { data: brands }, { data: sizes }] = await Promise.all([
    supabase.from("categories").select("id, name").order("id", { ascending: true }),
    supabase.from("brands").select("id, name").order("name", { ascending: true }),
    supabase.from("sizes").select("id, label").order("sort_order", { ascending: true }),
  ])

  return (
    <main className="min-h-screen bg-[#F5F3F8] px-4 py-8 sm:px-6 lg:px-8">
      <CreateListingForm categories={categories ?? []} brands={brands ?? []} sizes={sizes ?? []} />
    </main>
  )
}
