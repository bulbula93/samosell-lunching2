"use client"

import Link from "next/link"
import { useEffect } from "react"
import UiEmptyState from "@/components/shared/UiEmptyState"
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
    <main className="ui-page-shell flex min-h-[70vh] items-center px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <UiEmptyState
          role="alert"
          icon="!"
          title={ka.catalog.errorTitle}
          description={ka.catalog.errorDescription}
          actions={
            <>
              <button type="button" onClick={reset} className="ui-btn-primary">{ka.catalog.retry}</button>
              <Link href="/" className="ui-btn-secondary">მთავარ გვერდზე</Link>
            </>
          }
        />
      </div>
    </main>
  )
}
