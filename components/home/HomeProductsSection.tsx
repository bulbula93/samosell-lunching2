import Link from "next/link"
import { estimateOldPrice, formatCount, formatPrice, formatRelativeAge, sellerLabel } from "@/lib/home-page"
import SmartImage from "@/components/shared/SmartImage"
import type { CatalogListing } from "@/types/marketplace"

function HeartIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 21C11.7348 21 11.4804 20.8946 11.2929 20.7071L4.92893 14.3431C3.02369 12.4379 3.02369 9.34976 4.92893 7.44453C6.83417 5.53929 9.92228 5.53929 11.8275 7.44453L12 7.617L12.1725 7.44453C14.0777 5.53929 17.1658 5.53929 19.0711 7.44453C20.9763 9.34976 20.9763 12.4379 19.0711 14.3431L12.7071 20.7071C12.5196 20.8946 12.2652 21 12 21Z" />
    </svg>
  )
}

function StarRow() {
  return (
    <div className="flex items-center gap-0.5 text-[#F88A51]">
      {Array.from({ length: 5 }).map((_, index) => (
        <svg key={index} viewBox="0 0 24 24" fill={index < 4 ? "currentColor" : "none"} aria-hidden="true" className="h-[11px] w-[11px] stroke-current stroke-[1.7]">
          <path d="M12 3.75L14.6238 8.77735L20.1737 9.53896L16.0868 13.3864L17.0517 18.846L12 16.3375L6.94835 18.846L7.91325 13.3864L3.82631 9.53896L9.37618 8.77735L12 3.75Z" />
        </svg>
      ))}
    </div>
  )
}

function SectionArrow({ direction }: { direction: "left" | "right" }) {
  return (
    <button
      suppressHydrationWarning
      type="button"
      aria-label={direction === "left" ? "წინა" : "შემდეგი"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D9D9D9] bg-white text-[#F88A51] transition hover:-translate-y-0.5 hover:shadow-sm"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`h-3.5 w-3.5 ${direction === "right" ? "rotate-180" : ""}`}>
        <path d="M14.5 6L8.5 12L14.5 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function ProductCard({ item }: { item: CatalogListing }) {
  const oldPrice = estimateOldPrice(Number(item.price) || 0)

  return (
    <article className="w-full max-w-[243px]">
      <Link href={`/listing/${item.slug}`} className="group block">
        <div className="relative h-[256px] overflow-hidden rounded-[8px] bg-white">
          <SmartImage
            src={item.cover_image_url}
            alt={item.title}
            wrapperClassName="h-full w-full"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            fallbackLabel="სურათი მალე დაემატება"
          />
          <div className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#212831] text-white">
            <HeartIcon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="line-clamp-1 text-[14px] font-medium leading-5 text-[#2D2D2D]">{sellerLabel(item)}</span>
              <span className="shrink-0 text-[12px] font-normal leading-5 text-[#F88A51]">{formatRelativeAge(item.published_at)}</span>
            </div>
            <StarRow />
          </div>

          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-1 text-[14px] font-normal uppercase leading-5 text-[#2D2D2D]">{item.title}</h3>
            <span className="shrink-0 text-[14px] leading-5 text-[#2D2D2D]">ზომა {item.size_label || "44"}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[20px] font-semibold leading-8 text-[#212832]">{formatPrice(Number(item.price) || 0, item.currency)}</span>
              <span className="text-[16px] leading-8 text-black/60 line-through">{formatPrice(oldPrice, item.currency)}</span>
            </div>
            <span className="inline-flex h-[30px] items-center justify-center rounded-full bg-[rgba(253,155,27,0.8)] px-3 text-[14px] font-medium leading-[18px] text-white">
              -10%
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}

export default function HomeProductsSection({ title, href, count, items }: { title: string; href: string; count: number; items: CatalogListing[] }) {
  return (
    <section className="bg-[#ECECEC] px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h2 className="text-[28px] font-bold leading-8 text-[#2D2D2D]">{title}</h2>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[16px] font-medium leading-6 text-[#2D2D2D]">{formatCount(count)}</span>
              <Link
                href={href}
                className="inline-flex h-10 items-center justify-center rounded-full border border-[#2D2D2D] bg-white px-4 text-[12px] font-medium leading-5 text-[#2D2D2D] transition hover:bg-[#fff5ef]"
              >
                ნახე ყველა
              </Link>
            </div>
          </div>

          <div className="mt-1 hidden items-center gap-3 sm:flex">
            <SectionArrow direction="left" />
            <SectionArrow direction="right" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-5">
          {items.map((item) => (
            <ProductCard key={`${title}-${item.id}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}
