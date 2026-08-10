import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import { formatDateOnly } from "@/lib/boosts"
import { formatPrice } from "@/lib/listings"
import { marketplaceOrderStatusDescription } from "@/lib/orders"
import type { MarketplaceOrder, MarketplaceOrderRole } from "@/types/order"
import OrderStatusBadge from "./OrderStatusBadge"
import OrderStatusControl from "./OrderStatusControl"

export default function OrderCard({
  order,
  role,
}: {
  order: MarketplaceOrder
  role: MarketplaceOrderRole
}) {
  return (
    <article className="ui-card overflow-hidden">
      <div className="grid sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="relative aspect-[4/3] min-h-44 bg-surface-alt sm:aspect-auto sm:min-h-full">
          <SmartImage
            src={order.listing_cover_image_url}
            alt={`${order.listing_title} — შეკვეთის ნივთი`}
            wrapperClassName="absolute inset-0 h-full w-full"
            sizes="(max-width: 639px) 100vw, 210px"
            fallbackLabel="სურათი აღარ არის ხელმისაწვდომი"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatusBadge status={order.status} />
                <span className="ui-pill-soft">
                  {role === "buyer" ? "ვყიდულობ" : "ვყიდი"}
                </span>
              </div>
              <h2 className="mt-3 line-clamp-2 break-words text-lg font-black leading-7 text-text sm:text-xl">
                {order.listing_title}
              </h2>
              <p className="mt-1 text-xl font-black text-brand">
                {formatPrice(order.total_amount, order.currency)}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-soft">
                {marketplaceOrderStatusDescription(order.status)}
              </p>
              <p className="mt-2 text-xs leading-5 text-text-soft">
                შეკვეთა: {formatDateOnly(order.created_at)} · განახლდა: {formatDateOnly(order.updated_at)}
              </p>
            </div>

            <Link href={`/listing/${order.listing_slug}`} className="ui-btn-secondary shrink-0">
              ნივთის ნახვა
            </Link>
          </div>

          <dl className="grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold text-text-soft">ნივთი</dt>
              <dd className="mt-1 font-bold text-text">{formatPrice(order.item_price, order.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-soft">მიწოდება</dt>
              <dd className="mt-1 font-bold text-text">{formatPrice(order.delivery_price, order.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-soft">Samosell-ის საკომისიო</dt>
              <dd className="mt-1 font-bold text-text">{formatPrice(order.platform_fee, order.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-soft">დაცვის საფასური</dt>
              <dd className="mt-1 font-bold text-text">{formatPrice(order.buyer_protection_fee, order.currency)}</dd>
            </div>
          </dl>

          <OrderStatusControl
            key={`${order.status}-${order.updated_at}`}
            orderId={order.id}
            listingTitle={order.listing_title}
            role={role}
            status={order.status}
            updatedAt={order.updated_at}
          />
        </div>
      </div>
    </article>
  )
}
