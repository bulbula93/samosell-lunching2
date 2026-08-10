"use client"

import { useFormStatus } from "react-dom"
import { reviewCopy } from "@/lib/reviews"

export default function ReviewSubmitButton({ isUpdate }: { isUpdate: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-live="polite"
      className="ui-btn-primary min-h-11 w-full disabled:cursor-wait disabled:opacity-60 sm:w-auto"
    >
      {pending ? reviewCopy.pending : isUpdate ? reviewCopy.update : reviewCopy.submit}
    </button>
  )
}
