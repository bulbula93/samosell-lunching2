import Link from "next/link"
import {
  restoreSellerAction,
  reviewModerationReportAction,
} from "@/app/moderation/actions"
import ModerationSubmitButton from "@/components/moderation/ModerationSubmitButton"
import { formatPrice, listingStatusLabel } from "@/lib/listings"
import {
  MODERATION_NOTE_MAX_LENGTH,
  reportPriority,
  reportPriorityLabel,
  reportReasonLabel,
  reportStatusLabel,
} from "@/lib/moderation"
import type { AdminListingReport } from "@/types/moderation"

type AdminReviewCardProps = {
  item: AdminListingReport
  relatedOpenReports?: number
  referenceTime: string
}

export default function AdminReviewCard({
  item,
  relatedOpenReports = 1,
  referenceTime,
}: AdminReviewCardProps) {
  const sellerLabel = item.seller_full_name || item.seller_username || "გამყიდველი"
  const reporterLabel = item.reporter_full_name || item.reporter_username || "რეპორტის ავტორი"
  const canReview = item.status === "open" || item.status === "reviewing"
  const priority = reportPriority("listing", item.reason)
  const isAged =
    canReview && new Date(referenceTime).getTime() - new Date(item.created_at).getTime() >= 24 * 60 * 60 * 1000

  return (
    <article className="ui-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="ui-eyebrow">განცხადების რეპორტი</div>
            <span
              className={
                priority === "high"
                  ? "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-800"
                  : "rounded-full border border-line bg-surface-alt px-3 py-1 text-xs font-semibold text-text-soft"
              }
            >
              {reportPriorityLabel(priority)}
            </span>
            {isAged ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
                24სთ+
              </span>
            ) : null}
            {relatedOpenReports > 1 ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
                ამ გამყიდველზე {relatedOpenReports} ღია სიგნალი
              </span>
            ) : null}
          </div>
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
              <input type="hidden" name="reportKind" value="listing" />
              <input type="hidden" name="reportId" value={item.id} />
              <ModerationSubmitButton
                idleLabel="გამყიდველის აღდგენა"
                pendingLabel="აღდგენა…"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              />
            </form>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
          <div className="font-semibold text-text">მიზეზი</div>
          <div className="mt-1">{reportReasonLabel("listing", item.reason)}</div>
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

      {canReview ? (
        <form
          action={reviewModerationReportAction}
          className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_auto]"
        >
          <input type="hidden" name="reportKind" value="listing" />
          <input type="hidden" name="reportId" value={item.id} />

          <div>
            <label
              htmlFor={`listing-note-${item.id}`}
              className="mb-2 block text-sm font-semibold text-text"
            >
              შიდა შენიშვნა
            </label>
            <textarea
              id={`listing-note-${item.id}`}
              name="moderationNote"
              defaultValue={item.moderation_note || ""}
              maxLength={MODERATION_NOTE_MAX_LENGTH}
              placeholder="მხოლოდ მოდერაციის გუნდისთვის"
              className="min-h-28 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-soft focus:border-brand focus:ring-4 focus:ring-brand-soft/70"
            />
          </div>

          <div>
            <label
              htmlFor={`listing-decision-${item.id}`}
              className="mb-2 block text-sm font-semibold text-text"
            >
              გადაწყვეტილება
            </label>
            <select
              id={`listing-decision-${item.id}`}
              name="decision"
              defaultValue={item.status === "open" ? "reviewing" : "resolved"}
              className="ui-input"
            >
              <option value="reviewing">გადაიყვანე განხილვაში</option>
              <option value="resolved">მონიშნე მოგვარებულად</option>
              <option value="dismissed">უარყავი რეპორტი</option>
              <option value="hide_listing">დამალე განცხადება</option>
              <option value="suspend_user">შეზღუდე გამყიდველი</option>
            </select>
          </div>

          <ModerationSubmitButton
            idleLabel="შენახვა"
            pendingLabel="ინახება…"
            className="ui-btn-primary min-h-12 self-end px-6"
          />
        </form>
      ) : null}
    </article>
  )
}
