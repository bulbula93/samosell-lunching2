import { submitUserReportAction } from "@/app/moderation/actions"
import ModerationSubmitButton from "@/components/moderation/ModerationSubmitButton"
import { REPORT_DETAILS_MAX_LENGTH } from "@/lib/moderation"

export default function ReportUserForm({
  reportedUserId,
  contextListingId,
  nextPath,
}: {
  reportedUserId: string
  contextListingId?: string
  nextPath: string
}) {
  const reasonId = `user-report-reason-${reportedUserId}`
  const detailsId = `user-report-details-${reportedUserId}`

  return (
    <details className="rounded-xl border border-line bg-surface-alt">
      <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-semibold text-text marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        მომხმარებლის დარეპორტება
      </summary>
      <form action={submitUserReportAction} className="border-t border-line p-4">
        <input type="hidden" name="reportedUserId" value={reportedUserId} />
        <input
          type="hidden"
          name="contextListingId"
          value={contextListingId || ""}
        />
        <input type="hidden" name="nextPath" value={nextPath} />

        <p className="text-xs leading-5 text-text-soft">
          გამოიყენე თაღლითობის, სპამის, მუქარის ან სხვის სახელად წარმოდგენის
          შემთხვევაში.
        </p>

        <div className="mt-4 grid gap-3">
          <div>
            <label
              htmlFor={reasonId}
              className="mb-2 block text-sm font-medium text-text"
            >
              მიზეზი
            </label>
            <select
              id={reasonId}
              name="reason"
              defaultValue="other"
              className="ui-input"
              required
            >
              <option value="spam">სპამი</option>
              <option value="scam">თაღლითობის მცდელობა</option>
              <option value="harassment">შეწუხება ან მუქარა</option>
              <option value="impersonation">სხვის სახელად წარმოდგენა</option>
              <option value="prohibited">აკრძალული ქცევა</option>
              <option value="other">სხვა</option>
            </select>
          </div>

          <div>
            <label
              htmlFor={detailsId}
              className="mb-2 block text-sm font-medium text-text"
            >
              დეტალები
            </label>
            <textarea
              id={detailsId}
              name="details"
              rows={4}
              maxLength={REPORT_DETAILS_MAX_LENGTH}
              className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-soft focus:border-brand focus:ring-4 focus:ring-brand-soft/70"
              placeholder="მოკლედ აღწერე პრობლემა"
            />
          </div>
        </div>

        <ModerationSubmitButton
          idleLabel="მომხმარებლის რეპორტი"
          pendingLabel="იგზავნება…"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        />
      </form>
    </details>
  )
}
