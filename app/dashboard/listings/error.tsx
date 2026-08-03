"use client"

import Link from "next/link"
import { useEffect } from "react"

export default function MyListingsError({
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
    <main className="flex min-h-[65vh] items-center justify-center bg-bg px-4 py-10">
      <section role="alert" className="ui-card w-full max-w-xl p-7 text-center sm:p-9">
        <div
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl font-black text-red-700"
        >
          !
        </div>
        <h1 className="mt-5 text-2xl font-black text-text">
          განცხადებები ვერ ჩაიტვირთა
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-soft">
          მონაცემების მიღებისას დროებითი პრობლემა წარმოიშვა. სცადე ხელახლა.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="ui-btn-primary">
            ხელახლა ცდა
          </button>
          <Link href="/dashboard" className="ui-btn-secondary">
            კაბინეტში დაბრუნება
          </Link>
        </div>
      </section>
    </main>
  )
}
