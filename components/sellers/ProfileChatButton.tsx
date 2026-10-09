"use client"

import { useActionState } from "react"
import { openProfileChatAction } from "@/app/seller/actions"

type ProfileChatButtonProps = {
  userId: string
  variant?: "default" | "profile"
}

export default function ProfileChatButton({ userId, variant = "default" }: ProfileChatButtonProps) {
  const [state, action, pending] = useActionState(openProfileChatAction, { message: "" })
  return (
    <form action={action}>
      <input type="hidden" name="recipientId" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className={variant === "profile"
          ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b8d9d2] bg-white px-4 py-2.5 text-sm font-semibold text-[#075a53] transition hover:border-[#075a53] hover:bg-[#eff8f6] disabled:opacity-50"
          : "ui-btn-secondary min-h-10 disabled:opacity-50"}
      >
        {pending ? "იხსნება…" : "ჩათი"}
      </button>
      {state.message ? <p role="alert" className="mt-2 max-w-56 text-xs text-red-700">{state.message}</p> : null}
    </form>
  )
}
