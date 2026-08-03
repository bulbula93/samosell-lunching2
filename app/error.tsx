"use client"

import Link from "next/link"
import { useEffect } from "react"
import { ka } from "@/lib/i18n/ka"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-bg px-4">
      <section role="alert" className="ui-card w-full max-w-xl p-8 text-center sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">SAMOSELL</p>
        <h1 className="mt-4 text-2xl font-black text-text">{ka.catalog.errorTitle}</h1>
        <p className="mt-3 text-sm leading-7 text-text-soft">{ka.catalog.errorDescription}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="ui-btn-primary">{ka.catalog.retry}</button>
          <Link href="/" className="ui-btn-secondary">მთავარ გვერდზე</Link>
        </div>
      </section>
    </main>
  )
}
