import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import { getTbcLaunchReadinessChecks } from "@/lib/tbc-readiness"

export const dynamic = "force-dynamic"

export default async function TbcReadinessPage() {
  await requireAdminUser("/dashboard")
  const checks = await getTbcLaunchReadinessChecks()
  const flagEnabled = checks.find((item) => item.key === "feature_flag")?.ok ?? false
  const configurationReady = checks
    .filter((item) => !["feature_flag"].includes(item.key))
    .every((item) => item.ok)

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="ui-eyebrow">TBC launch readiness</div>
        <h1 className="mt-3 text-3xl font-black text-text sm:text-4xl">გადახდების მზადყოფნა</h1>
        <p className="mt-3 text-sm leading-7 text-text-soft">
          {flagEnabled ? "Live TBC checkout ჩართულია" : "Prepared — live TBC checkout disabled"}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/admin/payments" className="ui-btn-secondary">გადახდები</Link>
          <Link href="/admin" className="ui-btn-secondary">ადმინის მთავარი</Link>
        </div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <div key={check.key} className="ui-card flex items-start gap-3 p-5">
            <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${check.ok ? "bg-emerald-500" : "bg-amber-400"}`} />
            <div>
              <div className="font-bold text-text">{check.label}</div>
              <div className="mt-1 text-sm text-text-soft">{check.detail}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-[1.5rem] border border-line bg-surface-alt p-5 text-sm leading-7 text-text-soft">
        კონფიგურაციის ტექნიკური მზადყოფნა: <strong className="text-text">{configurationReady ? "მზადაა" : "ბანკის მონაცემებს ან migration-ს ელოდება"}</strong>.
        ეს გვერდი არასოდეს აჩვენებს credential-ის მნიშვნელობას და feature flag-ს არ ცვლის.
      </section>
    </main>
  )
}
