import Link from "next/link"
import HeroListingCarousel from "@/components/home/HeroListingCarousel"
import type { HeroListingItem } from "@/components/home/HeroListingCarousel"
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
    brand_name: item.brand_name,
    category_name: item.category_name,
  }))

  return (
    <section className="bg-white px-3 pb-9 pt-4 sm:px-4 sm:pb-12">
      <div className="ui-container !px-0">
        <div className="relative overflow-hidden rounded-[30px] border border-[#ece7de] bg-[#fbf8f2] shadow-[0_18px_60px_rgba(7,63,59,0.06)]">
          <div aria-hidden="true" className="absolute -left-24 top-24 h-56 w-56 rounded-full bg-[#ff7a00]/10" />
          <div aria-hidden="true" className="absolute right-[-7rem] top-20 h-[360px] w-[420px] rounded-[48%_52%_56%_44%] bg-[#dceeea]/80" />
          <div aria-hidden="true" className="absolute bottom-[-8rem] right-[22%] h-64 w-64 rounded-full bg-[#ff7a00]/10" />

          <div className="relative grid min-h-[520px] items-center gap-6 px-6 py-9 sm:px-9 sm:py-11 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10 lg:px-14 lg:py-12">
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">Samo$ell marketplace</p>
              <h1 className="mt-5 text-balance text-[clamp(2.5rem,5vw,4.8rem)] font-black leading-[0.98] tracking-[-0.055em]">
                <span className="block text-brand">შენი სტილი</span>
                <span className="mt-2 block text-accent">ახალ ისტორიებს ქმნის</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-text-soft sm:text-lg">
                იყიდე და გაყიდე მოდური ნივთები მარტივად, პირდაპირ დაუკავშირდი გამყიდველს და აღმოაჩინე განსხვავებული სტილი ერთ სივრცეში.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/catalog?vip=1&sort=vip"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-accent px-6 text-sm font-black text-brand shadow-[0_12px_28px_rgba(255,122,0,0.16)] transition hover:-translate-y-0.5 hover:bg-accent-hover hover:text-white"
                >
                  გააქტიურე VIP MAX
                </Link>
                <Link
                  href="/catalog"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-brand/15 bg-white/85 px-6 text-sm font-black text-brand transition hover:border-brand/30 hover:bg-white"
                >
                  ნახე კატალოგი
                </Link>
              </div>

              <div className="mt-8 grid max-w-2xl gap-3 text-xs font-semibold text-brand sm:grid-cols-3">
                <div className="flex items-center gap-2 rounded-2xl bg-white/72 px-3 py-3"><span className="text-accent">✓</span><span>პირდაპირი ჩათი</span></div>
                <div className="flex items-center gap-2 rounded-2xl bg-white/72 px-3 py-3"><span className="text-accent">♡</span><span>რჩეულებში შენახვა</span></div>
                <div className="flex items-center gap-2 rounded-2xl bg-white/72 px-3 py-3"><span className="text-accent">↗</span><span>მარტივი გამოქვეყნება</span></div>
              </div>
            </div>

            <div className="relative z-10 mx-auto h-[360px] w-full max-w-[760px] sm:h-[420px] lg:h-[440px]">
              {carouselItems.length > 0 ? (
                <HeroListingCarousel items={carouselItems} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-[28px] border border-brand/10 bg-white/70 p-8 text-center shadow-[0_20px_60px_rgba(7,63,59,0.08)]">
                  <div>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent">★</div>
                    <h2 className="mt-5 text-2xl font-black text-brand">VIP MAX სივრცე</h2>
                    <p className="mt-3 max-w-sm text-sm leading-7 text-text-soft">აქ გამოჩნდება აქტიური VIP MAX განცხადებები დიდი ვიზუალური პრეზენტაციით.</p>
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
