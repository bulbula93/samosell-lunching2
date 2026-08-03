import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import type { CatalogListing } from "@/types/marketplace"

export default function HomePromoBanner({ bannerItems }: { bannerItems: CatalogListing[] }) {
  const featured = bannerItems[0]

  if (!featured) {
    return (
      <section className="bg-[#ECECEC] px-4 pb-10 sm:px-6">
        <div className="mx-auto flex min-h-[260px] max-w-[1392px] items-center overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#2E3134_0%,#4A3328_55%,#F88A51_160%)] px-7 py-10 text-white sm:px-12">
          <div className="max-w-xl">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#F9A578]">SamoSell რეკლამა</div>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">გამოჩნდი მთავარ გვერდზე</h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-white/75 sm:text-base">
              გააძლიერე შენი განცხადება VIP სტატუსით ან დაიკავე მთავარი სარეკლამო ბანერი.
            </p>
            <Link href="/dashboard/listings" className="mt-7 inline-flex h-12 items-center rounded-lg bg-[#F88A51] px-6 text-sm font-bold text-[#2E3134] transition hover:bg-[#ff9d69]">
              აირჩიე განცხადება
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const seller = featured.seller_username || featured.seller_full_name || "SamoSell გამყიდველი"

  return (
    <section className="bg-[#ECECEC] px-4 pb-10 sm:px-6">
      <Link
        href={`/listing/${featured.slug}`}
        aria-label={`${featured.title} — სარეკლამო განცხადების ნახვა`}
        className="group relative mx-auto block min-h-[300px] max-w-[1392px] overflow-hidden rounded-2xl bg-[#202225] text-white shadow-[0_24px_70px_rgba(46,49,52,0.16)] sm:min-h-[360px]"
      >
        <SmartImage
          src={featured.cover_image_url}
          alt={featured.title}
          wrapperClassName="absolute inset-0 h-full w-full"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
          fallbackLabel="სარეკლამო ბანერი"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,20,22,0.94)_0%,rgba(20,20,22,0.72)_40%,rgba(20,20,22,0.12)_78%,rgba(20,20,22,0.2)_100%)]" />
        <div className="relative z-10 flex min-h-[300px] max-w-2xl flex-col justify-end p-7 sm:min-h-[360px] sm:p-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#F88A51] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#2E3134]">რეკლამა</span>
            <span className="text-xs font-semibold text-white/70">{seller}</span>
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{featured.title}</h2>
          <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-7 text-white/75 sm:text-base">
            {featured.description || "აღმოაჩინე ეს გამორჩეული შეთავაზება SamoSell-ზე."}
          </p>
          <div className="mt-7 flex items-center gap-4">
            <span className="inline-flex h-12 items-center rounded-lg bg-white px-6 text-sm font-bold text-[#2E3134] transition group-hover:bg-[#F88A51]">
              შეთავაზების ნახვა
            </span>
            <span className="text-lg font-black">{featured.price} {featured.currency === "GEL" ? "₾" : featured.currency}</span>
          </div>
        </div>
      </Link>
    </section>
  )
}
