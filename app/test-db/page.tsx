import type { Metadata } from "next"
import { ensureInternalTestPageAccess } from "@/lib/test-page-access"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}


export default async function TestDbPage() {
  await ensureInternalTestPageAccess()
  const hasEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!hasEnv) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-6 text-3xl font-black">Supabase Test</h1>
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          ჯერ შექმენი <code>.env.local</code> ფაილი და ჩასვი შენი Supabase URL და Publishable Key.
        </div>
      </main>
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("id", { ascending: true })

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-black">Supabase Test</h1>

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
          Error: {error.message}
        </div>
      ) : (
        <div className="space-y-3">
          {data?.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="text-lg font-bold">{item.name}</div>
              <div className="text-sm text-neutral-500">{item.slug}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
