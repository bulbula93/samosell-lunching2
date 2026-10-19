import Link from "next/link"
import Avatar from "@/components/shared/Avatar"
import SmartImage from "@/components/shared/SmartImage"
import { listingPriceLabel } from "@/lib/listings"

export type StoreVipListing = {
  id: string
  slug: string
  title: string
  price: number
  currency: string
  sale_type: string | null
  cover_image_url: string | null
  vip_until?: string | null
  is_vip: boolean
  is_featured: boolean
  promotion_tier: number | null
  published_at: string | null
  seller_id: string
  seller_username: string | null
  seller_full_name: string | null
  seller_store_logo_url: string | null
}

export default function StoreVipCard({
  item,
  demo = false,
  featured = false,
}: {
  item: StoreVipListing
  demo?: boolean
  featured?: boolean
}) {
  const storeName = item.seller_full_name || item.seller_username || "მაღაზია"
  const productHref = demo ? "/stores/showcase" : "/listing/" + encodeURIComponent(item.slug)
  const storeHref = demo ? "/stores/showcase" : "/seller/" + encodeURIComponent(item.seller_username || "")
  const label = item.is_featured ? "VIP MAX" : "VIP"

  return (
    <article className={"flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-line bg-white shadow-[0_12px_34px_rgba(7,63,59,0.08)] " + (featured ? "p-3 sm:p-4" : "p-2.5 sm:p-3")}>
      <Link href={productHref} className="group block min-w-0" aria-label={item.title + " — " + storeName}>
        <div className={"relative overflow-hidden rounded-[17px] bg-[#f3e9de] " + (featured ? "aspect-[5/3.6]" : "aspect-[4/3]")}>
          {demo ? (
            <div
              role="img"
              aria-label={"საჩვენებელი ფოტო: " + item.title}
              className="h-full w-full bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.025]"
              style={{ backgroundImage: "url('" + (item.cover_image_url || "/brand/samosell-shops-boutique.webp") + "')" }}
            />
          ) : (
            <SmartImage
              src={item.cover_image_url}
              alt={item.title}
              wrapperClassName="h-full w-full"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
              sizes={featured ? "(max-width: 1024px) 90vw, 420px" : "(max-width: 768px) 90vw, 33vw"}
            />
          )}
          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-accent px-3 py-1.5 text-[11px] font-black text-brand shadow-sm">{label}</span>
            {demo ? <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black text-brand shadow-sm">დემო</span> : null}
          </div>
        </div>
        <div className="flex items-start justify-between gap-3 px-1 pb-3 pt-4">
          <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-bold leading-6 text-text sm:text-base">{item.title}</h3>
          <span className="shrink-0 text-base font-black text-brand">{listingPriceLabel(item.price, item.currency, item.sale_type)}</span>
        </div>
      </Link>
      <Link href={storeHref} className="mt-auto flex min-w-0 items-center gap-3 rounded-xl border-t border-line px-1 pt-3 hover:text-brand" aria-label={storeName + " — მაღაზიის ნახვა"}>
        <Avatar
          src={item.seller_store_logo_url}
          alt={storeName + " ლოგო"}
          fallbackText={storeName}
          sizeClassName={featured ? "h-12 w-12" : "h-10 w-10"}
          textClassName="text-xs"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-brand">{storeName}</p>
          <p className="text-[11px] text-text-soft">მაღაზიის ნახვა ↗</p>
        </div>
      </Link>
    </article>
  )
}
