import Link from "next/link"
import HeroListingCarousel from "@/components/home/HeroListingCarousel"
import type { HeroListingItem } from "@/components/home/HeroListingCarousel"
import { ka } from "@/lib/i18n/ka"
import type { CatalogListing } from "@/types/marketplace"

export default function HomeSearchHeroSection({
  vipItems,
  popularItems,
}: {
  vipItems: CatalogListing[]
  popularItems: CatalogListing[]
}) {
  const activeVipItems = vipItems.filter((item) => item.is_vip).slice(0, 8)
  const showcaseItems = activeVipItems.length > 0 ? activeVipItems : popularItems.slice(0, 8)
  const showcaseMode = activeVipItems.length > 0 ? "vip" : "popular"
  const carouselItems: HeroListingItem[] = showcaseItems.map((item) => ({
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
    <section className="overflow-hidden border-b border-line bg-[radial-gradient(circle_at_85%_15%,rgba(40,170,153,0.22),transparent_32%),linear-gradient(135deg,#eff8f6_0%,#f9fbfa_54%,#e5f1ee_100%)]">
      <div className="ui-container grid min-h-[500px] items-center gap-10 py-12 md:grid-cols-[1.08fr_0.92fr] md:py-16 lg:min-h-[570px]">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">{ka.home.eyebrow}</p>
          <h1 className="mt-5 max-w-[15ch] text-balance text-[clamp(2.35rem,5.5vw,4.7rem)] font-normal leading-[1.09] tracking-[-0.025em] text-text">
            {ka.home.title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-text-soft sm:text-lg">
            {ka.home.description}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/catalog" className="ui-btn-primary min-h-12 px-7 text-base">
              {ka.home.startShopping}
            </Link>
            <Link href="/dashboard/listings/new" className="ui-btn-secondary min-h-12 px-7 text-base">
              {ka.home.startSelling}
            </Link>
          </div>
          <p className="mt-6 text-sm font-semibold text-text-soft">
            რეალური განცხადებები · პირდაპირი კავშირი გამყიდველთან
          </p>
        </div>

        <div className="relative mx-auto h-[340px] w-full max-w-[520px] sm:h-[420px]">
          {carouselItems.length > 0 ? (
            <HeroListingCarousel items={carouselItems} mode={showcaseMode} />
          ) : (
            <div className="relative flex h-full overflow-hidden rounded-[32px] border border-[#e8c778]/55 bg-[radial-gradient(circle_at_85%_15%,rgba(246,217,142,0.2),transparent_30%),linear-gradient(145deg,#073f3b_0%,#052c29_100%)] p-7 text-white shadow-[0_28px_80px_rgba(7,63,59,0.2)] sm:p-10">
              <div className="relative z-10 flex max-w-sm flex-col justify-end">
                <span className="w-fit rounded-full border border-[#f6d98e]/55 bg-white/5 px-4 py-2 text-xs font-black tracking-[0.18em] text-[#f6d98e]">
                  VIP სივრცე
                </span>
                <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.035em] sm:text-4xl">
                  შენი ნივთი გამოაჩინე პირველივე ეკრანზე
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/70">
                  აქ გამოჩნდება მხოლოდ აქტიური VIP განცხადებები
                </p>
                <Link
                  href="/dashboard/listings"
                  className="mt-7 inline-flex min-h-12 w-fit items-center justify-center rounded-xl bg-[#f6d98e] px-6 text-sm font-black text-[#073f3b] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  შექმენი VIP განცხადება
                </Link>
              </div>
              <div aria-hidden="true" className="absolute -right-12 -top-12 h-48 w-48 rounded-full border border-[#f6d98e]/20" />
              <div aria-hidden="true" className="absolute -right-3 top-16 h-32 w-32 rounded-full border border-[#f6d98e]/15" />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
