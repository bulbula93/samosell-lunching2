"use client"

import { useFormStatus } from "react-dom"

export default function AdminAdSubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" className="ui-btn-primary" disabled={pending} aria-disabled={pending}>
      {pending ? "ინახება…" : children}
    </button>
  )
}
