import { notFound } from "next/navigation"
import CreateListingForm from "@/components/dashboard/CreateListingForm"
import DeleteListingCard from "@/components/dashboard/DeleteListingCard"
import { createClient } from "@/lib/supabase/server"
import { deleteListingAction } from "@/app/dashboard/listings/actions"
import type { ListingFormInitialData } from "@/types/marketplace"

export default async function DashboardEditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: categories }, { data: brands }, { data: sizes }, { data: listing }, { data: images }] = await Promise.all([
    supabase.from("categories").select("id, name").order("id", { ascending: true }),
    supabase.from("brands").select("id, name").order("name", { ascending: true }),
    supabase.from("sizes").select("id, label").order("sort_order", { ascending: true }),
    supabase
      .from("listings")
      .select("id, seller_id, category_id, brand_id, size_id, title, description, price, condition, sale_type, gender, color, material, city, status, published_at")
      .eq("id", id)
      .eq("seller_id", user!.id)
      .maybeSingle(),
    supabase.from("listing_images").select("id, image_url, sort_order, listing_id").eq("listing_id", id).order("sort_order", { ascending: true }),
  ])

  if (!listing) notFound()

  const initialData: ListingFormInitialData = {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: String(listing.price),
    category_id: listing.category_id,
    brand_id: listing.brand_id ?? "",
    size_id: listing.size_id ?? "",
    condition: listing.condition,
    sale_type: listing.sale_type,
    gender: listing.gender,
    color: listing.color ?? "",
    material: listing.material ?? "",
    city: listing.city ?? "",
    status: listing.status,
    published_at: listing.published_at,
    images: (images ?? []).map((image) => ({ id: image.id, image_url: image.image_url, sort_order: image.sort_order })),
  }

  return (
    <main className="min-h-screen bg-[#F5F3F8] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[856px] flex-col gap-6">
        <CreateListingForm mode="edit" categories={categories ?? []} brands={brands ?? []} sizes={sizes ?? []} initialData={initialData} />
        <DeleteListingCard listingId={listing.id} listingTitle={listing.title} action={deleteListingAction} />
      </div>
    </main>
  )
}
