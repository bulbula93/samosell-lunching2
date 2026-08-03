import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import type { CatalogListing } from "@/types/marketplace"

export default function HomePromoBanner({ bannerItems }: { bannerItems: CatalogListing[] }) {
  const featured = bannerItems[0]

  if (!featured) {
    return (
      <section className="border-b border-line bg-white py-10">
        <div className="ui-container">
          <div className="overflow-hidden rounded-3xl border border-brand/15 bg-[radial-gradient(circle_at_90%_10%,rgba(158,227,218,0.4),transparent_34%),linear-gradient(125deg,#073f3b,#075a53)] px-6 py-9 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9EE3DA]">SAMOSELL რეკლამა</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.025em] sm:text-3xl">გამოჩნდი მთავარ გვერდზე</h2>
              <p className="mt-3 text-sm leading-7 text-white/75">
                გააძლიერე შენი აქტიური განცხადება VIP სტატუსით ან მთავარი გვერდის სარეკლამო ბანერით.
              </p>
            </div>
            <Link href="/dashboard/listings" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-black text-brand transition hover:bg-brand-soft lg:mt-0">
              აირჩიე განცხადება
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const seller = featured.seller_username || featured.seller_full_name || "SAMOSELL გამყიდველი"

  return (
    <section className="border-b border-line bg-white py-10">
      <div className="ui-container">
        <Link
          href={`/listing/${featured.slug}`}
          aria-label={`${featured.title} — სარეკლამო განცხადების ნახვა`}
          className="group relative block min-h-[300px] overflow-hidden rounded-3xl bg-brand text-white shadow-[0_24px_60px_rgba(7,63,59,0.16)] sm:min-h-[360px]"
        >
          <SmartImage
            src={featured.cover_image_url}
            alt={featured.title}
            wrapperClassName="absolute inset-0 h-full w-full"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
            fallbackLabel="სარეკლამო განცხადება"
            sizes="(max-width: 768px) 100vw, 1440px"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,63,59,0.96)_0%,rgba(7,63,59,0.78)_44%,rgba(7,63,59,0.12)_82%)]" />
          <div className="relative z-10 flex min-h-[300px] max-w-2xl flex-col justify-end p-7 sm:min-h-[360px] sm:p-12">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-brand">რეკლამა</span>
              <span className="text-xs font-semibold text-white/75">{seller}</span>
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] sm:text-5xl">{featured.title}</h2>
            {featured.description ? <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-7 text-white/75 sm:text-base">{featured.description}</p> : null}
            <span className="mt-7 inline-flex h-12 w-fit items-center rounded-xl bg-white px-6 text-sm font-black text-brand transition group-hover:bg-brand-soft">
              შეთავაზების ნახვა
            </span>
          </div>
        </Link>
      </div>
    </section>
  )
}
