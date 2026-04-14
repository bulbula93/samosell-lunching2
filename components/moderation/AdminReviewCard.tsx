import Link from "next/link"
import { restoreSellerAction, reviewListingReportAction } from "@/app/moderation/actions"
import { formatPrice, listingStatusLabel } from "@/lib/listings"
import type { AdminListingReport } from "@/types/moderation"

function reportStatusLabel(value: string) {
  switch (value) {
    case "open": return "ღია"
    case "reviewing": return "მიმდინარე"
    case "resolved": return "მოგვარებული"
    case "dismissed": return "უარყოფილი"
    default: return value
  }
}

function reportReasonLabel(value: string) {
  switch (value) {
    case "spam": return "სპამი"
    case "fake": return "ყალბი განცხადება"
    case "prohibited": return "აკრძალული ნივთი"
    case "abuse": return "შეურაცხმყოფელი შინაარსი"
    case "wrong_info": return "არასწორი ინფორმაცია"
    case "other": return "სხვა"
    default: return value
  }
}

export default function AdminReviewCard({ item }: { item: AdminListingReport }) {
  const sellerLabel = item.seller_full_name || item.seller_username || "გამყიდველი"
  const reporterLabel = item.reporter_full_name || item.reporter_username || "რეპორტის ავტორი"

  return (
    <article className="ui-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="ui-eyebrow">რეპორტი</div>
          <h3 className="mt-2 text-2xl font-black text-text">{item.listing_title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-soft">
            <span>{formatPrice(item.price, item.currency)}</span>
            <span>•</span>
            <span>{listingStatusLabel(item.listing_status)}</span>
            <span className="ui-pill !px-3 !py-1 text-xs">{reportStatusLabel(item.status)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/listing/${item.listing_slug}`} className="ui-btn-secondary">
            განცხადების ნახვა
          </Link>
          {item.seller_is_suspended ? (
            <form action={restoreSellerAction}>
              <input type="hidden" name="sellerId" value={item.seller_id} />
              <button className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
                გამყიდველის აღდგენა
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
          <div className="font-semibold text-text">მიზეზი</div>
          <div className="mt-1">{reportReasonLabel(item.reason)}</div>
        </div>
        <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
          <div className="font-semibold text-text">რეპორტის ავტორი</div>
          <div className="mt-1">{reporterLabel}</div>
        </div>
        <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
          <div className="font-semibold text-text">გამყიდველი</div>
          <div className="mt-1">{sellerLabel}</div>
        </div>
        <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
          <div className="font-semibold text-text">შექმნილია</div>
          <div className="mt-1">{new Date(item.created_at).toLocaleString("ka-GE")}</div>
        </div>
      </div>

      <div className="mt-4 rounded-[1.2rem] border border-line bg-surface-alt px-4 py-3 text-sm leading-7 text-text-soft">
        {item.details || "დამატებითი აღწერა არ არის მითითებული."}
      </div>

      <form action={reviewListingReportAction} className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_auto]">
        <input type="hidden" name="reportId" value={item.id} />
        <input type="hidden" name="listingId" value={item.listing_id} />
        <input type="hidden" name="sellerId" value={item.seller_id} />

        <textarea
          name="moderationNote"
          defaultValue={item.moderation_note || ""}
          placeholder="შიდა შენიშვნა გუნდისთვის"
          className="min-h-28 w-full rounded-[1rem] border border-line bg-white px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-soft focus:border-brand focus:ring-4 focus:ring-brand-soft/70"
        />

        <select
          name="decision"
          defaultValue={item.status === "dismissed" ? "dismissed" : "resolved"}
          className="ui-input"
        >
          <option value="resolved">მონიშნე მოგვარებულად</option>
          <option value="dismissed">უარყავი რეპორტი</option>
          <option value="hide_listing">დამალე განცხადება</option>
          <option value="suspend_seller">შეზღუდე გამყიდველი</option>
        </select>

        <button className="ui-btn-primary h-12 self-start px-6">
          შენახვა
        </button>
      </form>
    </article>
  )
}
