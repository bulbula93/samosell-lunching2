import FlittSandboxButton from "./FlittSandboxButton"
import { getFlittReadiness } from "@/lib/flitt"

export default function FlittSandboxPage() {
  const readiness = getFlittReadiness()

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Admin / Sandbox</p>
        <h1 className="mt-2 text-3xl font-bold">Flitt test გადახდა</h1>
        <p className="mt-3 text-sm text-neutral-600">
          ეს გვერდი მხოლოდ Flitt-ის სატესტო გარემოსთვისაა. აქ შესრულებული გადახდა არ ააქტიურებს VIP-ს,
          რეკლამას ან სხვა ფასიან სერვისს.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-neutral-500">Mode</dt><dd className="font-semibold">{readiness.mode}</dd></div>
          <div><dt className="text-neutral-500">Feature flag</dt><dd className="font-semibold">{String(readiness.featureFlagEnabled)}</dd></div>
          <div><dt className="text-neutral-500">Merchant ID</dt><dd className="font-semibold">{readiness.merchantIdPresent ? "configured" : "missing"}</dd></div>
          <div><dt className="text-neutral-500">Secret key</dt><dd className="font-semibold">{readiness.secretPresent ? "configured" : "missing"}</dd></div>
        </dl>
      </section>

      {readiness.sandboxEnabled ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="font-semibold">Sandbox მზადაა</h2>
          <p className="mb-4 mt-1 text-sm text-neutral-700">ღილაკი ქმნის 1.00 GEL-ის სატესტო checkout-ს.</p>
          <FlittSandboxButton />
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm">
          Flitt sandbox გამორთულია. შეავსე Preview environment variables და ჩართე feature flag მხოლოდ Preview გარემოში.
        </section>
      )}
    </main>
  )
}
