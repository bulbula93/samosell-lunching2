"use client"

import { useActionState } from "react"
import { openProfileChatAction } from "@/app/seller/actions"
import SellerActionIcon from "@/components/sellers/SellerActionIcon"

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
          ? "flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-xl border border-[#b8d9d2] bg-white px-1.5 text-[11px] font-bold text-[#075a53] transition hover:border-[#075a53] hover:bg-[#eff8f6] disabled:opacity-50 sm:gap-2 sm:px-3 sm:text-sm"
          : "ui-btn-secondary min-h-10 disabled:opacity-50"}
      >
        {variant === "profile" ? <SellerActionIcon name="chat" /> : null}
        <span className="min-w-0 truncate">{pending ? "იხსნება…" : "ჩათი"}</span>
      </button>
      {state.message ? <p role="alert" className="mt-2 max-w-56 text-xs text-red-700">{state.message}</p> : null}
    </form>
  )
}
