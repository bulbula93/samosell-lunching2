import { notFound } from "next/navigation"
import CreateListingForm from "@/components/dashboard/CreateListingForm"
import DeleteListingCard from "@/components/dashboard/DeleteListingCard"
import { deleteListingAction } from "@/app/dashboard/listings/actions"
import { requireAuthenticatedUser } from "@/lib/auth"
import { isUuid } from "@/lib/listing-form"
import type { ListingFormInitialData } from "@/types/marketplace"

export default async function DashboardEditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const { supabase, user } = await requireAuthenticatedUser(`/dashboard/listings/${id}/edit`)
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, seller_id, category_id, brand_id, size_id, title, slug, description, price, condition, sale_type, gender, color, material, city, status, published_at")
    .eq("id", id)
    .eq("seller_id", user.id)
    .maybeSingle()

  if (listingError) throw new Error("Owned listing could not be loaded.")
  if (!listing) notFound()

  const [categoriesResult, brandsResult, sizesResult, imagesResult, currentBrandResult] = await Promise.all([
    supabase.from("categories").select("id, name").order("id", { ascending: true }),
    supabase.from("brands").select("id, name").eq("is_active", true).order("name", { ascending: true }),
    supabase.from("sizes").select("id, label").order("sort_order", { ascending: true }),
    supabase
      .from("listing_images")
      .select("id, image_url, sort_order, listing_id")
      .eq("listing_id", id)
      .order("sort_order", { ascending: true }),
    listing.brand_id
      ? supabase.from("brands").select("id, name").eq("id", listing.brand_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (
    categoriesResult.error ||
    brandsResult.error ||
    sizesResult.error ||
    imagesResult.error ||
    currentBrandResult.error
  ) {
    throw new Error("Listing editor data could not be loaded.")
  }

  const brands = [...(brandsResult.data ?? [])]
  if (currentBrandResult.data && !brands.some((brand) => brand.id === currentBrandResult.data?.id)) {
    brands.push(currentBrandResult.data)
  }

  const initialData: ListingFormInitialData = {
    id: listing.id,
    slug: listing.slug,
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
    images: (imagesResult.data ?? []).map((image) => ({ id: image.id, image_url: image.image_url, sort_order: image.sort_order })),
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <CreateListingForm
          mode="edit"
          categories={categoriesResult.data ?? []}
          brands={brands}
          sizes={sizesResult.data ?? []}
          initialData={initialData}
        />
        <DeleteListingCard listingId={listing.id} listingTitle={listing.title} action={deleteListingAction} />
      </div>
    </main>
  )
}
