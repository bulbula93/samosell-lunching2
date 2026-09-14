"use client"

import { useActionState } from "react"
import { openProfileChatAction } from "@/app/seller/actions"

export default function ProfileChatButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(openProfileChatAction, { message: "" })
  return <form action={action}>
    <input type="hidden" name="recipientId" value={userId} />
    <button type="submit" disabled={pending} className="ui-btn-secondary min-h-10 disabled:opacity-50">{pending ? "იხსნება…" : "ჩათი"}</button>
    {state.message ? <p role="alert" className="mt-2 max-w-56 text-xs text-red-700">{state.message}</p> : null}
  </form>
}
