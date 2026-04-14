import { toggleBlockUserAction } from "@/app/moderation/actions"

type BlockUserFormProps = {
  blockedId: string
  nextPath: string
  isBlocked: boolean
}

export default function BlockUserForm({ blockedId, nextPath, isBlocked }: BlockUserFormProps) {
  return (
    <form action={toggleBlockUserAction}>
      <input type="hidden" name="blockedId" value={blockedId} />
      <input type="hidden" name="nextPath" value={nextPath} />
      <button
        type="submit"
        className={isBlocked
          ? "inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
          : "ui-btn-secondary"
        }
      >
        {isBlocked ? "მოხსენი ბლოკი" : "დაბლოკე მომხმარებელი"}
      </button>
    </form>
  )
}
