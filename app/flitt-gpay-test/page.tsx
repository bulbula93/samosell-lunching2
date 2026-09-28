import { notFound } from "next/navigation"
import { getFlittReadiness } from "@/lib/flitt"
import FlittGpayPreviewButton from "./FlittGpayPreviewButton"

const TEST_BRANCH = "test/flitt-gpay-preview-20260928"

export default function FlittGpayPreviewPage() {
  const isAllowedPreview =
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === TEST_BRANCH

  if (!isAllowedPreview) notFound()

  const readiness = getFlittReadiness()

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Preview only / Flitt Sandbox</p>
        <h1 className="mt-2 text-3xl font-bold">Google Pay test</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          ეს გვერდი არსებობს მხოლოდ დროებით Preview branch-ზე. გადახდა არის Flitt TEST 1.00 GEL და
          არ ააქტიურებს VIP-ს, რეკლამას ან სხვა ფასიან სერვისს.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-neutral-500">Vercel environment</dt><dd className="font-semibold">{process.env.VERCEL_ENV ?? "unknown"}</dd></div>
          <div><dt className="text-neutral-500">Flitt mode</dt><dd className="font-semibold">{readiness.mode}</dd></div>
          <div><dt className="text-neutral-500">Feature flag</dt><dd className="font-semibold">{String(readiness.featureFlagEnabled)}</dd></div>
          <div><dt className="text-neutral-500">Merchant ID</dt><dd className="font-semibold">{readiness.merchantIdPresent ? "configured" : "missing"}</dd></div>
          <div><dt className="text-neutral-500">Secret key</dt><dd className="font-semibold">{readiness.secretPresent ? "configured" : "missing"}</dd></div>
          <div><dt className="text-neutral-500">API URL</dt><dd className="font-semibold">{readiness.apiUrlPresent ? "configured" : "missing"}</dd></div>
        </dl>
      </section>

      {readiness.sandboxEnabled ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="font-semibold">Sandbox მზადაა</h2>
          <p className="mb-4 mt-1 text-sm text-neutral-700">
            ღილაკი შექმნის 1.00 GEL test checkout-ს. Flitt-ის გვერდზე აირჩიე Google Pay.
          </p>
          <FlittGpayPreviewButton />
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm">
          Flitt sandbox Preview-ზე მზად არ არის. არცერთი secret value ამ გვერდზე არ ჩანს.
        </section>
      )}
    </main>
  )
}
