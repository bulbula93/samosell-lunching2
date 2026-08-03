"use client"

import Link from "next/link"

export default function ChatThreadError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="ui-container py-12">
      <section
        aria-labelledby="thread-error-title"
        className="ui-card mx-auto max-w-2xl border-red-200 bg-red-50 p-6 text-red-900 sm:p-8"
      >
        <h1 id="thread-error-title" className="text-2xl font-black">
          მიმოწერა ვერ ჩაიტვირთა
        </h1>
        <p className="mt-3 text-sm leading-6">
          შეტყობინებები არ წაშლილა. სცადე ხელახლა ან დაბრუნდი ინბოქსში.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="ui-btn-primary">
            ხელახლა ცდა
          </button>
          <Link href="/dashboard/chats" className="ui-btn-secondary">
            ინბოქსში დაბრუნება
          </Link>
        </div>
      </section>
    </main>
  )
}
