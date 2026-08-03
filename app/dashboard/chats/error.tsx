"use client"

import Link from "next/link"

export default function ChatsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="ui-container py-12">
      <section
        aria-labelledby="chats-error-title"
        className="ui-card mx-auto max-w-2xl border-red-200 bg-red-50 p-6 text-red-900 sm:p-8"
      >
        <h1 id="chats-error-title" className="text-2xl font-black">
          შეტყობინებები ვერ გაიხსნა
        </h1>
        <p className="mt-3 text-sm leading-6">
          მონაცემები არ შეცვლილა. სცადე ხელახლა ან დაბრუნდი პირად კაბინეტში.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
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
