"use client"

import Link from "next/link"
import { useEffect } from "react"
import { ka } from "@/lib/i18n/ka"

export default function CatalogError({
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
      <section role="alert" className="ui-card w-full max-w-xl p-8 text-center">
        <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-2xl text-brand">!</div>
        <h1 className="mt-5 text-2xl font-black text-text">{ka.catalog.errorTitle}</h1>
        <p className="mt-3 text-sm leading-7 text-text-soft">{ka.catalog.errorDescription}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="ui-btn-primary">{ka.catalog.retry}</button>
          <Link href="/catalog" className="ui-btn-secondary">{ka.catalog.clear}</Link>
        </div>
      </section>
    </main>
  )
}
