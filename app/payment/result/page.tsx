import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

function statusText(status?: string | null) {
  switch (status) {
    case "approved": return "გადახდა წარმატებით დადასტურდა"
    case "declined": return "გადახდა უარყოფილია"
    case "expired": return "გადახდის სესია ვადაგასულია"
    case "reversed": return "გადახდა დაბრუნებულია"
    case "failed": return "გადახდის დამუშავება ვერ დასრულდა"
    case "pending": return "გადახდა მუშავდება"
    default: return "გადახდის სტატუსი ჯერ არ არის ხელმისაწვდომი"
  }
}

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const { order } = await searchParams
  const safeOrder = String(order ?? "").trim().slice(0, 1024)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let attempt: { status: string; amount: number; currency: string } | null = null
  if (user && safeOrder) {
    const { data } = await supabase
      .from("flitt_payment_attempts")
      .select("status, amount, currency")
      .eq("order_id", safeOrder)
      .eq("user_id", user.id)
      .maybeSingle()
    attempt = data
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">SamoSell Payments</p>
        <h1 className="mt-2 text-2xl font-bold">{statusText(attempt?.status)}</h1>
        <p className="mt-3 text-sm text-neutral-600">
          საბოლოო სტატუსი მიიღება მხოლოდ Flitt-ის ხელმოწერილი server callback-იდან. ბრაუზერის დაბრუნების გვერდი თვითონ გადახდას წარმატებულად არ ნიშნავს.
        </p>
        {attempt ? (
          <p className="mt-4 text-sm font-medium">
            თანხა: {(attempt.amount / 100).toFixed(2)} {attempt.currency}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">მთავარზე დაბრუნება</Link>
          <Link href="/admin/flitt-sandbox" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold">Sandbox-ზე დაბრუნება</Link>
        </div>
      </section>
    </main>
  )
}
