import { toggleBlockUserAction } from "@/app/moderation/actions"
import ModerationSubmitButton from "@/components/moderation/ModerationSubmitButton"

type BlockUserFormProps = {
  blockedId: string
  nextPath: string
  isBlocked: boolean
}

export default function BlockUserForm({
  blockedId,
  nextPath,
  isBlocked,
}: BlockUserFormProps) {
  return (
    <form action={toggleBlockUserAction}>
      <input type="hidden" name="blockedId" value={blockedId} />
      <input type="hidden" name="nextPath" value={nextPath} />
      <input
        type="hidden"
        name="shouldBlock"
        value={isBlocked ? "false" : "true"}
      />
      <ModerationSubmitButton
        idleLabel={isBlocked ? "ბლოკის მოხსნა" : "მომხმარებლის დაბლოკვა"}
        pendingLabel={isBlocked ? "ბლოკი იხსნება…" : "იბლოკება…"}
        className={
          isBlocked
            ? "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            : "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-text transition hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        }
      />
    </form>
  )
}
