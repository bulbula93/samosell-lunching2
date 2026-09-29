import Link from "next/link"
import { ka } from "@/lib/i18n/ka"
import type { PopularBrand } from "@/lib/home-page"

export default function HomeCollectionsSection({ brands }: { brands: PopularBrand[] }) {
  if (brands.length === 0) return null

  return (
    <section id="brands" className="border-b border-line/70 bg-[#fbfaf7] py-11 sm:py-14">
      <div className="ui-container">
        <div className="flex items-end justify-between gap-5">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.035em] text-brand sm:text-3xl">{ka.home.brands}</h2>
            <p className="mt-2 text-sm leading-6 text-text-soft">აღმოაჩინე ბრენდები, რომლებიც ახლა ყველაზე აქტიურია Samo$ell-ზე.</p>
          </div>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {brands.map((brand, index) => (
            <Link
              key={brand.name}
              href={`/catalog?brand=${encodeURIComponent(brand.name)}`}
              className="group relative flex min-h-28 flex-col items-center justify-center overflow-hidden rounded-[22px] border border-[#e7ebe8] bg-white px-3 text-center shadow-[0_8px_22px_rgba(7,63,59,0.04)] transition hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-[0_14px_30px_rgba(7,63,59,0.08)]"
            >
              <span aria-hidden="true" className={`absolute -right-5 -top-5 h-14 w-14 rounded-full ${index % 2 === 0 ? "bg-accent/10" : "bg-brand-soft"}`} />
              <span className="relative text-base font-black text-brand transition group-hover:text-accent">{brand.name}</span>
              <span className="relative mt-2 text-xs text-text-soft">{brand.count} განცხადება</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
