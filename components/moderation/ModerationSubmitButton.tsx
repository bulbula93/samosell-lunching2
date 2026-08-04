"use client"

import { useFormStatus } from "react-dom"

export default function ModerationSubmitButton({
  idleLabel,
  pendingLabel,
  className,
}: {
  idleLabel: string
  pendingLabel: string
  className: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  )
}
