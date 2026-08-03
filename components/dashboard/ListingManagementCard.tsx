import Link from "next/link"
import ListingStatusBadge from "@/components/dashboard/ListingStatusBadge"
import ListingStatusControl from "@/components/dashboard/ListingStatusControl"
import SmartImage from "@/components/shared/SmartImage"
import { activePromotionBadges, formatDateOnly } from "@/lib/boosts"
import { formatPrice } from "@/lib/listings"
import type { ListingStatus } from "@/lib/my-listings"

export type ListingManagementItem = {
  id: string
  title: string
  slug: string
  price: number | string
  currency: string
  status: ListingStatus
  created_at: string
  updated_at: string
  cover_image_url: string | null
  is_vip: boolean
  is_promoted?: boolean
  is_featured?: boolean
  vip_until?: string | null
  promoted_until?: string | null
  featured_until?: string | null
  featured_slot?: number | null
}

const DETAIL_VISIBLE_STATUSES = new Set<ListingStatus>(["active", "reserved", "sold"])

export default function ListingManagementCard({ item }: { item: ListingManagementItem }) {
  const promotionBadges = activePromotionBadges(item)
  const canOpenDetail = DETAIL_VISIBLE_STATUSES.has(item.status)

  return (
    <article className="ui-card overflow-hidden">
      <div className="grid gap-0 sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="relative aspect-[4/3] min-h-44 bg-surface-alt sm:aspect-auto sm:min-h-full">
          <SmartImage
            src={item.cover_image_url}
            alt={`${item.title} — მთავარი ფოტო`}
            wrapperClassName="absolute inset-0 h-full w-full"
            sizes="(max-width: 639px) 100vw, 210px"
            fallbackLabel="სურათი არ არის"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ListingStatusBadge status={item.status} />
                {promotionBadges.map((badge) => (
                  <span key={badge} className="ui-pill-vip-soft">
                    {badge}
                  </span>
                ))}
              </div>
              <h2 className="mt-3 line-clamp-2 break-words text-lg font-black leading-7 text-text sm:text-xl">
                {item.title}
              </h2>
              <p className="mt-1 text-lg font-black text-brand">
                {formatPrice(item.price, item.currency)}
              </p>
              <p className="mt-2 text-xs leading-5 text-text-soft">
                განახლდა: {formatDateOnly(item.updated_at)} · შეიქმნა: {formatDateOnly(item.created_at)}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {canOpenDetail ? (
                <Link href={`/listing/${item.slug}`} className="ui-btn-secondary">
                  ნახვა
                </Link>
              ) : null}
              <Link href={`/dashboard/listings/${item.id}/edit`} className="ui-btn-primary">
                რედაქტირება
              </Link>
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <ListingStatusControl
              key={`${item.status}-${item.updated_at}`}
              listingId={item.id}
              listingTitle={item.title}
              status={item.status}
              updatedAt={item.updated_at}
            />
          </div>
        </div>
      </div>
    </article>
  )
}
