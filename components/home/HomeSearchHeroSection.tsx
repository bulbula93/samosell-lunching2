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
    <section className="bg-white px-3 pb-5 pt-3 sm:px-4 sm:pb-12 sm:pt-4">
      <div className="ui-container !px-0">
        <div
          className="relative overflow-hidden rounded-[30px] border border-[#e8ded3] bg-[#ead0bd] bg-cover bg-center bg-no-repeat shadow-[0_18px_60px_rgba(7,63,59,0.08)]"
          style={{ backgroundImage: "url('/brand/samosell-hero-bg.jpg')" }}
        >
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,251,246,0.95)_0%,rgba(255,251,246,0.78)_34%,rgba(255,251,246,0.06)_56%,rgba(255,251,246,0.00)_100%)]" />

          <div className={`relative grid items-center gap-5 px-5 py-6 sm:min-h-[380px] sm:gap-6 sm:px-9 sm:py-11 lg:gap-10 lg:px-14 lg:py-12 ${carouselItems.length > 0 ? "lg:grid-cols-[0.82fr_1.18fr]" : "lg:grid-cols-1"}`}>
            <div className="relative z-10 max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand sm:text-xs sm:tracking-[0.22em]">{ka.home.eyebrow}</p>
              <h1 className="mt-3 max-w-[13ch] text-balance text-[1.8rem] font-normal leading-[1.1] tracking-[-0.035em] text-[#172321] sm:mt-5 sm:max-w-[15ch] sm:text-[clamp(2.45rem,5vw,4.65rem)] sm:leading-[1.06] sm:tracking-[-0.04em]">
                {ka.home.title}
              </h1>
              <div className="mt-4 max-w-xl rounded-2xl bg-[#fffaf5]/78 px-3.5 py-2.5 sm:mt-6 shadow-[0_8px_24px_rgba(7,63,59,0.06)] backdrop-blur-[3px] sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
                <p className="text-sm leading-6 text-text-soft sm:text-lg sm:leading-8">
                  ახალი და მეორადი ტანსაცმლის ქართული ონლაინ პლატფორმა — 0% საკომისიო გაყიდვაზე.
                </p>
                <p className="mt-4 hidden text-sm font-semibold text-text-soft sm:mt-5 sm:block">
                  პირდაპირი კავშირი მყიდველთან და გამყიდველთან
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-7 sm:flex sm:flex-wrap">
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
