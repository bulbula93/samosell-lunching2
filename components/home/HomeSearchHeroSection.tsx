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

          <div className="relative grid min-h-[520px] items-center gap-6 px-6 py-9 sm:px-9 sm:py-11 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10 lg:px-14 lg:py-12">
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand">{ka.home.eyebrow}</p>
              <h1 className="mt-5 max-w-[15ch] text-balance text-[clamp(2.45rem,5vw,4.65rem)] font-normal leading-[1.06] tracking-[-0.04em] text-[#172321]">
                {ka.home.title}
              </h1>
              <div className="mt-6 max-w-xl rounded-2xl bg-[#fffaf5]/78 px-4 py-3 shadow-[0_8px_24px_rgba(7,63,59,0.06)] backdrop-blur-[3px] sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
                <p className="text-base leading-8 text-text-soft sm:text-lg">
                  {ka.home.description}
                </p>
                <p className="mt-4 text-sm font-semibold text-text-soft sm:mt-5">
                  რეალური განცხადებები · პირდაპირი კავშირი გამყიდველთან
                </p>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/catalog"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-brand/15 bg-white/85 px-6 text-sm font-black text-brand transition hover:border-brand/30 hover:bg-white"
                >
                  ნახე კატალოგი
                </Link>
                <Link
                  href="/catalog?sale_type=gift"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#ffd5b2] bg-[#fff7ed]/92 px-5 text-sm font-black text-[#d85f0e] shadow-[0_8px_22px_rgba(232,109,19,0.08)] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <span aria-hidden="true">🎁</span>
                  უფასოდ
                </Link>
              </div>

            </div>

            <div className="relative z-10 mx-auto h-[360px] w-full max-w-[760px] sm:h-[420px] lg:h-[440px]">
              {carouselItems.length > 0 ? (
                <HeroListingCarousel items={carouselItems} />
              ) : (
                <div className="flex h-full items-end justify-end p-3 sm:p-5 lg:p-6">
                  <div className="w-full max-w-[460px] rounded-[28px] border border-white/70 bg-white/90 p-7 text-center shadow-[0_22px_58px_rgba(7,63,59,0.14)] backdrop-blur-md sm:p-8">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent">★</div>
                    <h2 className="mt-4 text-2xl font-black text-brand sm:text-[28px]">VIP MAX სივრცე</h2>
                    <p className="mx-auto mt-3 max-w-[360px] text-sm leading-7 text-text-soft sm:text-[15px]">აქ გამოჩნდება აქტიური VIP MAX განცხადებები დიდი ვიზუალური პრეზენტაციით.</p>
                    <Link
                      href="/dashboard/listings"
                      className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-accent px-7 text-sm font-black text-brand shadow-[0_12px_28px_rgba(233,150,79,0.18)] transition hover:-translate-y-0.5 hover:bg-accent-hover hover:text-white"
                    >
                      გააქტიურე VIP MAX
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
