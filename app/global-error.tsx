"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ka">
      <body className="bg-neutral-50 text-neutral-900">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <div className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
            სისტემური შეცდომა
          </div>
          <h1 className="mt-6 text-4xl font-black">რაღაც ვერ შესრულდა</h1>
          <p className="mt-4 max-w-xl leading-7 text-neutral-600">
            სცადე გვერდის თავიდან ჩატვირთვა. თუ პრობლემა განმეორდა, გადაამოწმე environment variables, Supabase migrations და production config.
          </p>
          <div className="mt-2 text-sm text-neutral-500">{error?.message || "უცნობი შეცდომა"}</div>
          <button onClick={() => reset()} className="mt-8 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">
            ხელახლა ცდა
          </button>
        </main>
      </body>
    </html>
  )
}
