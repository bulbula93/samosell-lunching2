import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchFlittOrderStatus, type FlittAttemptStatus } from "@/lib/flitt"

export const dynamic = "force-dynamic"
export const revalidate = 0

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

type PaymentAttempt = {
  status: FlittAttemptStatus
  amount: number
  currency: string
  merchant_id: string
  provider_payment_id: string | null
  mode: string
  purpose: string
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
  const userId = user?.id ?? null

  let attempt: PaymentAttempt | null = null
  let fallbackChecked = false

  if (userId && safeOrder) {
    const { data } = await supabase
      .from("flitt_payment_attempts")
      .select("status, amount, currency, merchant_id, provider_payment_id, mode, purpose")
      .eq("order_id", safeOrder)
      .eq("user_id", userId)
      .maybeSingle()
    attempt = data as PaymentAttempt | null
  }

  if (userId && attempt?.status === "pending" && attempt.mode === "test" && attempt.purpose === "sandbox_test") {
    fallbackChecked = true
    try {
      const verified = await fetchFlittOrderStatus({
        orderId: safeOrder,
        amount: attempt.amount,
        currency: attempt.currency,
        merchantId: attempt.merchant_id,
        providerPaymentId: attempt.provider_payment_id,
        status: attempt.status,
      })

      const now = new Date().toISOString()
      const admin = createAdminClient()
      const nextStatus = verified.nextStatus as FlittAttemptStatus
      const { error: updateError } = await admin
        .from("flitt_payment_attempts")
        .update({
          provider_payment_id: attempt.provider_payment_id ?? verified.paymentId,
          status: nextStatus,
          provider_status: verified.providerStatus || null,
          response_status: verified.responseStatus || null,
          updated_at: now,
        })
        .eq("order_id", safeOrder)
        .eq("user_id", userId)

      if (updateError) {
        console.error("[flitt] signed status fallback persistence failed", { code: updateError.code, orderId: safeOrder })
      } else {
        attempt = {
          ...attempt,
          provider_payment_id: attempt.provider_payment_id ?? verified.paymentId,
          status: nextStatus,
        }
      }
    } catch (error) {
      console.warn("[flitt] signed status fallback unavailable", {
        orderId: safeOrder,
        message: error instanceof Error ? error.message : "unknown_error",
      })
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">SamoSell Payments</p>
        <h1 className="mt-2 text-2xl font-bold">{statusText(attempt?.status)}</h1>
        <p className="mt-3 text-sm text-neutral-600">
          საბოლოო სტატუსს პირველ რიგში Flitt-ის ხელმოწერილი server callback ადასტურებს. თუ callback არ მოვიდა,
          SamoSell დამატებით ამოწმებს შეკვეთას Flitt-ის ხელმოწერილი server-to-server status API-ით. ბრაუზერის
          დაბრუნების მონაცემები თვითონ გადახდას წარმატებულად ვერ ნიშნავს.
        </p>
        {attempt ? (
          <p className="mt-4 text-sm font-medium">
            თანხა: {(attempt.amount / 100).toFixed(2)} {attempt.currency}
          </p>
        ) : null}
        {attempt?.status === "pending" && fallbackChecked ? (
          <p className="mt-3 text-xs text-neutral-500">
            Flitt-ის სტატუსი გადამოწმდა, მაგრამ ტრანზაქცია ჯერ დასრულებული არ არის. რამდენიმე წამში შეგიძლია ხელახლა შეამოწმო.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">მთავარზე დაბრუნება</Link>
          {attempt?.status === "pending" && safeOrder ? (
            <Link
              href={`/payment/result?order=${encodeURIComponent(safeOrder)}`}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold"
            >
              სტატუსის ხელახლა შემოწმება
            </Link>
          ) : null}
          <Link href="/admin/flitt-sandbox" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold">Sandbox-ზე დაბრუნება</Link>
        </div>
      </section>
    </main>
  )
}
