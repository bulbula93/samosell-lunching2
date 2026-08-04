import Link from "next/link"
import {
  restoreSellerAction,
  reviewModerationReportAction,
} from "@/app/moderation/actions"
import ModerationSubmitButton from "@/components/moderation/ModerationSubmitButton"
import {
  MODERATION_NOTE_MAX_LENGTH,
  reportReasonLabel,
  reportStatusLabel,
} from "@/lib/moderation"
import type { AdminUserReport } from "@/types/moderation"

export default function AdminUserReviewCard({
  item,
}: {
  item: AdminUserReport
}) {
  const reportedLabel =
    item.reported_full_name || item.reported_username || "მომხმარებელი"
  const reporterLabel =
    item.reporter_full_name || item.reporter_username || "რეპორტის ავტორი"
  const canReview = item.status === "open" || item.status === "reviewing"

  return (
    <article className="ui-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="ui-eyebrow">მომხმარებლის რეპორტი</div>
          <h3 className="mt-2 break-words text-2xl font-black text-text">
            {reportedLabel}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-soft">
            <span>{reportReasonLabel("user", item.reason)}</span>
            <span aria-hidden="true">•</span>
            <span className="ui-pill !px-3 !py-1 text-xs">
              {reportStatusLabel(item.status)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {item.reported_username ? (
            <Link
              href={`/seller/${encodeURIComponent(item.reported_username)}`}
              className="ui-btn-secondary"
            >
              პროფილის ნახვა
            </Link>
          ) : null}
          {item.context_listing_slug ? (
            <Link
              href={`/listing/${item.context_listing_slug}`}
              className="ui-btn-secondary"
            >
              დაკავშირებული განცხადება
            </Link>
          ) : null}
          {item.reported_is_suspended ? (
            <form action={restoreSellerAction}>
              <input type="hidden" name="reportKind" value="user" />
              <input type="hidden" name="reportId" value={item.id} />
              <ModerationSubmitButton
                idleLabel="მომხმარებლის აღდგენა"
                pendingLabel="აღდგენა…"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              />
            </form>
          ) : null}
        </div>
      </div>

      <dl className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-text-soft">
          <dt className="font-semibold text-text">რეპორტის ავტორი</dt>
          <dd className="mt-1 break-words">{reporterLabel}</dd>
        </div>
        <div className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-text-soft">
          <dt className="font-semibold text-text">ანგარიში</dt>
          <dd className="mt-1 break-words">{reportedLabel}</dd>
        </div>
        <div className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-text-soft">
          <dt className="font-semibold text-text">შექმნილია</dt>
          <dd className="mt-1">
            {new Date(item.created_at).toLocaleString("ka-GE")}
          </dd>
        </div>
      </dl>

      <div className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-line bg-surface-alt px-4 py-3 text-sm leading-7 text-text-soft [overflow-wrap:anywhere]">
        {item.details || "დამატებითი აღწერა არ არის მითითებული."}
      </div>

      {canReview ? (
        <form
          action={reviewModerationReportAction}
          className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_auto]"
        >
          <input type="hidden" name="reportKind" value="user" />
          <input type="hidden" name="reportId" value={item.id} />

          <div>
            <label
              htmlFor={`user-note-${item.id}`}
              className="mb-2 block text-sm font-semibold text-text"
            >
              შიდა შენიშვნა
            </label>
            <textarea
              id={`user-note-${item.id}`}
              name="moderationNote"
              defaultValue={item.moderation_note || ""}
              maxLength={MODERATION_NOTE_MAX_LENGTH}
              placeholder="მხოლოდ მოდერაციის გუნდისთვის"
              className="min-h-28 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-soft focus:border-brand focus:ring-4 focus:ring-brand-soft/70"
            />
          </div>

          <div>
            <label
              htmlFor={`user-decision-${item.id}`}
              className="mb-2 block text-sm font-semibold text-text"
            >
              გადაწყვეტილება
            </label>
            <select
              id={`user-decision-${item.id}`}
              name="decision"
              defaultValue={item.status === "open" ? "reviewing" : "resolved"}
              className="ui-input"
            >
              <option value="reviewing">გადაიყვანე განხილვაში</option>
              <option value="resolved">მონიშნე მოგვარებულად</option>
              <option value="dismissed">უარყავი რეპორტი</option>
              <option value="suspend_user">შეზღუდე მომხმარებელი</option>
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
