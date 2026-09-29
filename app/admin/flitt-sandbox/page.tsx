import FlittSandboxButton from "./FlittSandboxButton"
import { requireAdminUser } from "@/lib/auth"
import { getFlittReadiness } from "@/lib/flitt"

export default async function FlittSandboxPage() {
  await requireAdminUser("/dashboard")
  const readiness = getFlittReadiness()
  const liveMode = readiness.mode === "live"
  const ready = liveMode
    ? readiness.liveEnabled && readiness.productionDeployment
    : readiness.sandboxEnabled
  const amountMinor = liveMode ? 10 : 100

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Admin / Flitt validation
        </p>
        <h1 className="mt-2 text-3xl font-bold">Flitt გადახდის შემოწმება</h1>
        <p className="mt-3 text-sm text-neutral-600">
          {liveMode
            ? "Production რეჟიმში ეს გვერდი ქმნის ფიქსირებულ 0.10 GEL რეალურ ტრანზაქციას. ის არ ააქტიურებს VIP-ს, რეკლამას ან სხვა ფასიან სერვისს."
            : "Test რეჟიმში ეს გვერდი ქმნის sandbox checkout-ს და არ ააქტიურებს VIP-ს, რეკლამას ან სხვა ფასიან სერვისს."}
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-neutral-500">Mode</dt><dd className="font-semibold">{readiness.mode}</dd></div>
          <div><dt className="text-neutral-500">Feature flag</dt><dd className="font-semibold">{String(readiness.featureFlagEnabled)}</dd></div>
          <div><dt className="text-neutral-500">Production deployment</dt><dd className="font-semibold">{String(readiness.productionDeployment)}</dd></div>
          <div><dt className="text-neutral-500">Merchant ID</dt><dd className="font-semibold">{readiness.merchantIdPresent ? "configured" : "missing"}</dd></div>
          <div><dt className="text-neutral-500">Secret key</dt><dd className="font-semibold">{readiness.secretPresent ? "configured" : "missing"}</dd></div>
          <div><dt className="text-neutral-500">API URL</dt><dd className="font-semibold">{readiness.apiUrlPresent ? "configured" : "missing"}</dd></div>
        </dl>
      </section>

      {ready ? (
        <section className={liveMode
          ? "rounded-2xl border border-amber-300 bg-amber-50 p-5"
          : "rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
        }>
          <h2 className="font-semibold">{liveMode ? "Production checkout მზადაა" : "Sandbox მზადაა"}</h2>
          <p className="mb-4 mt-1 text-sm text-neutral-700">
            {liveMode
              ? "ღილაკზე დაჭერის შემდეგ Flitt-ის რეალურ checkout-ზე გადახვალ და ბარათიდან 0.10 GEL ჩამოიჭრება წარმატებული გადახდის შემთხვევაში."
              : "ღილაკი ქმნის 1.00 GEL-ის სატესტო checkout-ს."}
          </p>
          <FlittSandboxButton mode={readiness.mode} amountMinor={amountMinor} />
        </section>
      ) : (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm">
          {liveMode
            ? "Flitt live checkout ჯერ მზად არ არის. Production-ში საჭიროა FLITT_MODE=live, ჩართული feature flag და მოქმედი merchant credentials/API URL."
            : "Flitt sandbox გამორთულია. Preview გარემოში შეავსე შესაბამისი variables და ჩართე feature flag."}
        </section>
      )}
    </main>
  )
}
