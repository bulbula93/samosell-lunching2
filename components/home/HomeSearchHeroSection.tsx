import Link from "next/link"
import HeroListingCarousel from "@/components/home/HeroListingCarousel"
import type { HeroListingItem } from "@/components/home/HeroListingCarousel"
import { ka } from "@/lib/i18n/ka"
import type { CatalogListing } from "@/types/marketplace"

export default function HomeSearchHeroSection({ featuredItems }: { featuredItems: CatalogListing[] }) {
  const activeVipMaxItems = featuredItems
    .filter((item) => item.is_featured && item.is_promoted && item.is_vip)
    .slice(0, 8)

  const carouselItems: HeroListingItem[] = activeVipMaxItems.map((item) => ({
    id: item.id,
    vip_until: item.vip_until,
    promoted_until: item.promoted_until,
    featured_until: item.featured_until,
    slug: item.slug,
    title: item.title,
    cover_image_url: item.cover_image_url,
    price: item.price,
    currency: item.currency,
    sale_type: item.sale_type,
    brand_name: item.brand_name,
    category_name: item.category_name,
  }))

  return (
    <section className="bg-white px-3 pb-9 pt-4 sm:px-4 sm:pb-12">
      <div className="ui-container !px-0">
        <div
          className="relative overflow-hidden rounded-[30px] border border-[#e8ded3] bg-[#ead0bd] bg-cover bg-center bg-no-repeat shadow-[0_18px_60px_rgba(7,63,59,0.08)]"
          style={{ backgroundImage: "url('/brand/samosell-hero-bg.jpg')" }}
        >
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,251,246,0.95)_0%,rgba(255,251,246,0.78)_34%,rgba(255,251,246,0.06)_56%,rgba(255,251,246,0.00)_100%)]" />

          <div className="relative grid min-h-[380px] items-center gap-6 px-6 py-9 sm:px-9 sm:py-11 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10 lg:px-14 lg:py-12">
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand">{ka.home.eyebrow}</p>
              <h1 className="mt-5 max-w-[15ch] text-balance text-[clamp(2.45rem,5vw,4.65rem)] font-normal leading-[1.06] tracking-[-0.04em] text-[#172321]">
                გაყიდე ტანსაცმელი უფასოდ.
              </h1>
              <div className="mt-6 max-w-xl rounded-2xl bg-[#fffaf5]/78 px-4 py-3 shadow-[0_8px_24px_rgba(7,63,59,0.06)] backdrop-blur-[3px] sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
                <p className="text-base leading-8 text-text-soft sm:text-lg">
                  ახალი და მეორადი ტანსაცმლის ქართული ონლაინ პლატფორმა — 0% საკომისიო გაყიდვაზე.
                </p>
                <p className="mt-4 text-sm font-semibold text-text-soft sm:mt-5">
                  პირდაპირი კავშირი მყიდველთან და გამყიდველთან
                </p>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/catalog"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-brand/15 bg-white/85 px-6 text-sm font-black text-brand transition hover:border-brand/30 hover:bg-white"
                >
                  იყიდე
                </Link>
                <Link href="/sell" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-black text-white transition hover:bg-brand-hover">გაყიდე უფასოდ</Link>
              </div>

            </div>

            {carouselItems.length > 0 ? <div className="relative z-10 mx-auto h-[360px] w-full max-w-[760px] sm:h-[420px] lg:h-[440px]">
              <HeroListingCarousel items={carouselItems} />
            </div> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
