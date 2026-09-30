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
    brand_name: item.brand_name,
    category_name: item.category_name,
  }))

  return (
    <section className="bg-white px-3 pb-9 pt-4 sm:px-4 sm:pb-12">
      <div className="ui-container !px-0">
        <div
          className="relative overflow-hidden rounded-[30px] border border-[#e8ded3] bg-[#ead0bd] shadow-[0_18px_60px_rgba(7,63,59,0.08)]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid slice"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <rect width="1600" height="900" fill="#ead0bd" />
            <g opacity="0.98">
              <line x1="870" y1="250" x2="1470" y2="250" stroke="#17120f" strokeWidth="14" strokeLinecap="round" />
              <line x1="905" y1="245" x2="905" y2="790" stroke="#17120f" strokeWidth="14" strokeLinecap="round" />
              <line x1="1435" y1="245" x2="1435" y2="790" stroke="#17120f" strokeWidth="14" strokeLinecap="round" />
              <line x1="888" y1="236" x2="922" y2="236" stroke="#17120f" strokeWidth="8" strokeLinecap="round" />
              <line x1="1418" y1="236" x2="1452" y2="236" stroke="#17120f" strokeWidth="8" strokeLinecap="round" />
            </g>

            <g stroke="#f5f0eb" strokeWidth="5" fill="none" strokeLinecap="round">
              <path d="M1000 246 C1000 225 1024 225 1024 245 L1024 292" />
              <path d="M1110 246 C1110 225 1134 225 1134 245 L1134 292" />
              <path d="M1215 246 C1215 225 1239 225 1239 245 L1239 292" />
              <path d="M1330 246 C1330 225 1354 225 1354 245 L1354 292" />
            </g>

            <g>
              <path d="M970 322 L1013 287 L1052 323 L1030 366 L1028 630 L974 646 L956 490 Z" fill="#c16f35" />
              <path d="M1004 300 L1013 287 L1022 301 L1019 330 L1008 330 Z" fill="#8a4f2c" />
              <path d="M1070 332 L1123 290 L1170 333 L1145 380 L1140 610 L1085 626 L1054 448 Z" fill="#d9ad98" />
              <path d="M1110 313 L1123 290 L1138 313 L1131 341 L1115 341 Z" fill="#ae765f" />
              <path d="M1175 336 L1224 294 L1272 336 L1245 375 L1240 566 L1188 566 L1166 425 Z" fill="#8f624c" />
              <path d="M1210 312 L1224 294 L1238 312 L1234 338 L1215 338 Z" fill="#6e4838" />
              <path d="M1260 328 L1326 295 L1384 330 L1360 372 L1364 640 L1285 656 L1250 438 Z" fill="#f4eee8" />
              <path d="M1310 310 L1326 295 L1342 310 L1338 338 L1316 338 Z" fill="#b98965" />
              <path d="M1286 350 C1308 335 1333 332 1360 346" stroke="#fffaf5" strokeWidth="18" strokeLinecap="round" opacity="0.75" />
              <path d="M1304 390 L1322 600" stroke="#fffaf5" strokeWidth="16" strokeLinecap="round" opacity="0.68" />
              <path d="M1086 368 L1098 584" stroke="#f3ded1" strokeWidth="13" strokeLinecap="round" opacity="0.68" />
              <path d="M985 373 L996 606" stroke="#e9a56e" strokeWidth="12" strokeLinecap="round" opacity="0.52" />
            </g>

            <ellipse cx="1170" cy="808" rx="330" ry="30" fill="#9f6b4e" opacity="0.10" />
          </svg>
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,251,246,0.96)_0%,rgba(255,251,246,0.80)_34%,rgba(255,251,246,0.10)_58%,rgba(255,251,246,0.00)_100%)]" />

          <div className="relative grid min-h-[520px] items-center gap-6 px-6 py-9 sm:px-9 sm:py-11 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10 lg:px-14 lg:py-12">
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand">{ka.home.eyebrow}</p>
              <h1 className="mt-5 max-w-[15ch] text-balance text-[clamp(2.45rem,5vw,4.65rem)] font-normal leading-[1.06] tracking-[-0.04em] text-[#172321]">
                {ka.home.title}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-text-soft sm:text-lg">
                {ka.home.description}
              </p>
              <p className="mt-5 text-sm font-semibold text-text-soft">
                რეალური განცხადებები · პირდაპირი კავშირი გამყიდველთან
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
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
                <div className="flex h-full items-end justify-end p-3 sm:p-5 lg:p-6">
                  <div className="w-full max-w-[360px] rounded-[24px] border border-white/70 bg-white/88 p-5 text-center shadow-[0_18px_50px_rgba(7,63,59,0.14)] backdrop-blur-md sm:p-6">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-lg text-accent">★</div>
                    <h2 className="mt-3 text-xl font-black text-brand">VIP MAX სივრცე</h2>
                    <p className="mt-2 text-sm leading-6 text-text-soft">აქ გამოჩნდება აქტიური VIP MAX განცხადებები დიდი ვიზუალური პრეზენტაციით.</p>
                    <Link
                      href="/dashboard/listings"
                      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-accent px-5 text-sm font-black text-brand shadow-[0_10px_24px_rgba(233,150,79,0.16)] transition hover:-translate-y-0.5 hover:bg-accent-hover hover:text-white"
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
