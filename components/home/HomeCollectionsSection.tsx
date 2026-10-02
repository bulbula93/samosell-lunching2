import Link from "next/link"
import { ka } from "@/lib/i18n/ka"
import type { PopularBrand } from "@/lib/home-page"

const brandThemes = [
  { orb: "bg-[#fff0df]", badge: "bg-[#fff7ef] text-[#e86d13]", ring: "ring-[#f6c99f]" },
  { orb: "bg-[#dff3ed]", badge: "bg-[#effaf6] text-brand", ring: "ring-[#aadfd1]" },
  { orb: "bg-[#fff2e8]", badge: "bg-[#fff7f2] text-[#e86d13]", ring: "ring-[#f7cfb1]" },
  { orb: "bg-[#dcefeb]", badge: "bg-[#eef8f5] text-brand", ring: "ring-[#a8d8ce]" },
] as const

export default function HomeCollectionsSection({ brands }: { brands: PopularBrand[] }) {
  if (brands.length === 0) return null

  return (
    <section id="brands" className="relative overflow-hidden border-b border-line/70 bg-[#fffaf6] py-12 sm:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-12 h-52 w-52 rounded-full bg-[#e8f6f1] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-56 w-56 rounded-full bg-[#fff0dc] blur-3xl" />

      <div className="ui-container relative">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/10 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-brand shadow-sm">
              <span className="h-2 w-2 rounded-full bg-accent" />
              ახლა აქტიურია
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] text-brand sm:text-4xl">
              {ka.home.brands}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-text-soft sm:text-base">
              იპოვე ბრენდები, რომლებზეც ამ წუთას ყველაზე მეტი აქტიური განცხადებაა Samo$ell-ზე.
            </p>
          </div>

          <Link
            href="/catalog"
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-2xl border border-brand/10 bg-white px-4 text-sm font-black text-brand shadow-sm transition hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-md sm:self-auto"
          >
            ყველა ბრენდი
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {brands.slice(0, 4).map((brand, index) => {
            const theme = brandThemes[index % brandThemes.length]
            return (
              <Link
                key={brand.name}
                href={`/catalog?brand=${encodeURIComponent(brand.name)}`}
                className="group relative min-h-[168px] overflow-hidden rounded-[28px] border border-[#e6ebe8] bg-white p-5 shadow-[0_10px_30px_rgba(7,63,59,0.055)] transition duration-300 hover:-translate-y-1 hover:border-brand/20 hover:shadow-[0_18px_38px_rgba(7,63,59,0.10)] sm:p-6"
              >
                <span
                  aria-hidden="true"
                  className={`absolute -right-8 -top-8 h-28 w-28 rounded-full ${theme.orb} transition duration-300 group-hover:scale-110`}
                />
                <span
                  aria-hidden="true"
                  className={`absolute right-5 top-5 h-2.5 w-2.5 rounded-full ring-4 ${theme.badge.split(" ")[0]} ${theme.ring}`}
                />

                <div className="relative flex h-full flex-col justify-between">
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${theme.badge}`}>
                      {brand.count} განცხადება
                    </span>
                    <h3 className="mt-5 text-xl font-black tracking-[-0.03em] text-brand transition group-hover:text-accent sm:text-2xl">
                      {brand.name}
                    </h3>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-xs font-bold text-text-soft">ნახე არჩევანი</span>
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7f7f4] text-lg font-black text-brand transition duration-300 group-hover:translate-x-0.5 group-hover:bg-brand group-hover:text-white"
                    >
                      →
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
