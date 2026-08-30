import Link from "next/link"
import { ka } from "@/lib/i18n/ka"
import type { PopularBrand } from "@/lib/home-page"

export default function HomeCollectionsSection({ brands }: { brands: PopularBrand[] }) {
  if (brands.length === 0) return null

  return (
    <section id="brands" className="border-b border-line bg-white py-12 sm:py-16">
      <div className="ui-container">
        <h2 className="text-2xl font-black tracking-[-0.025em] text-text sm:text-3xl">{ka.home.brands}</h2>
        <p className="mt-2 text-sm leading-6 text-text-soft">ბრენდები დალაგებულია აქტიური განცხადებების რაოდენობის მიხედვით</p>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {brands.map((brand) => (
            <Link
              key={brand.name}
              href={`/catalog?brand=${encodeURIComponent(brand.name)}`}
              className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-line bg-bg px-3 text-center transition hover:-translate-y-0.5 hover:border-brand/35 hover:bg-brand-soft/40 hover:shadow-[0_12px_30px_rgba(7,63,59,0.08)]"
            >
              <span className="text-base font-black text-text">{brand.name}</span>
              <span className="mt-2 text-xs text-text-soft">{brand.count} განცხადება</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
