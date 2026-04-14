import type { Metadata } from "next"
import { ensureInternalTestPageAccess } from "@/lib/test-page-access"
import CatalogListingCard from "@/components/listings/CatalogListingCard"
import SiteHeader from "@/components/layout/SiteHeader"
import StatCard from "@/components/shared/StatCard"
import { createClient } from "@/lib/supabase/server"
import type { CatalogListing } from "@/types/marketplace"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}


async function getCount(supabase: Awaited<ReturnType<typeof createClient>>, table: string) {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })

  return count ?? 0
}

export default async function TestMarketplacePage() {
  await ensureInternalTestPageAccess()
  const hasEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!hasEnv) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="mb-6 text-3xl font-black">Marketplace Schema Test</h1>
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          ჯერ შექმენი <code>.env.local</code> ფაილი და ჩასვი შენი Supabase URL და Publishable Key.
        </div>
      </main>
    )
  }

  const supabase = await createClient()

  const [categoriesCount, brandsCount, sizesCount, listingsCount] = await Promise.all([
    getCount(supabase, "categories"),
    getCount(supabase, "brands"),
    getCount(supabase, "sizes"),
    getCount(supabase, "listings"),
  ])

  const { data: brands, error: brandsError } = await supabase
    .from("brands")
    .select("id, name, slug")
    .order("name", { ascending: true })
    .limit(8)

  const { data: sizes, error: sizesError } = await supabase
    .from("sizes")
    .select("id, group_name, label")
    .order("group_name", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(10)

  const { data: listings, error: listingsError } = await supabase
    .from("listings_catalog")
    .select(
      "id, slug, title, description, price, currency, condition, city, material, color, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, cover_image_url, published_at, status"
    )
    .eq("status", "active")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(8)

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader />

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Marketplace database
          </p>
          <h1 className="text-4xl font-black md:text-5xl">Schema step 4 მზადაა</h1>
          <p className="mt-4 text-lg leading-8 text-neutral-600">
            ამ გვერდზე გადაამოწმებ, რომ storage bucket, cover image და public catalog სწორად მუშაობს Supabase-თან.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="კატეგორიები" value={categoriesCount} />
          <StatCard label="ბრენდები" value={brandsCount} />
          <StatCard label="ზომები" value={sizesCount} />
          <StatCard label="განცხადებები" value={listingsCount} />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-16 lg:grid-cols-[1.1fr_1.3fr]">
        <div className="space-y-8">
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">ბრენდები</h2>
            {brandsError ? (
              <p className="mt-4 text-sm text-red-600">Error: {brandsError.message}</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {brands?.map((brand) => (
                  <span
                    key={brand.id}
                    className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
                  >
                    {brand.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">ზომები</h2>
            {sizesError ? (
              <p className="mt-4 text-sm text-red-600">Error: {sizesError.message}</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {sizes?.map((size) => (
                  <span
                    key={size.id}
                    className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
                  >
                    {size.group_name}: {size.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-black">Listings catalog</h2>
            <span className="text-sm font-medium text-neutral-500">public active items</span>
          </div>

          {listingsError ? (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
              Error: {listingsError.message}
            </div>
          ) : listings && listings.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {(listings as CatalogListing[]).map((item) => (
                <CatalogListingCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-neutral-600">
              ჯერ active listing არ გაქვს. dashboard-იდან შექმენი განცხადება, ატვირთე ქავერ სურათი და ჩართე გამოქვეყნება.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
