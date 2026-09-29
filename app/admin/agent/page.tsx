import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import {
  buildFallbackAdminSummary,
  collectAdminAgentSnapshot,
} from "@/lib/admin-agent"
import AdminAgentClient from "@/components/admin/AdminAgentClient"
import StatCard from "@/components/shared/StatCard"

function signalTone(severity: "critical" | "warning" | "info") {
  if (severity === "critical") {
    return "border-red-200 bg-red-50 text-red-900"
  }
  if (severity === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-950"
  }
  return "border-sky-200 bg-sky-50 text-sky-900"
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminAgentPage() {
  const { supabase } = await requireAdminUser("/dashboard")
  const snapshot = await collectAdminAgentSnapshot(supabase)

  const openReports =
    snapshot.openListingReports +
    snapshot.openUserReports +
    snapshot.openStoryReports
  const activeSupport =
    snapshot.openSupportTickets + snapshot.reviewingSupportTickets
  const criticalSignals = snapshot.signals.filter(
    (signal) => signal.severity === "critical",
  ).length
  const warningSignals = snapshot.signals.filter(
    (signal) => signal.severity === "warning",
  ).length

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">AI ადმინისტრირება / Phase 1</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              SamoSell Admin Copilot
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              Live read-only ადმინისტრაციული ანალიზი Payments, Moderation,
              Support, VIP, Ads, Stores და System Health-ზე. Copilot
              პრიორიტეტებს ადგენს და შემდეგ ნაბიჯებს გთავაზობს, მაგრამ
              Phase 1-ში არცერთ ცვლილებას თვითონ არ ასრულებს.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin/payments" className="ui-btn-secondary">
              Payments
            </Link>
            <Link href="/admin/reports" className="ui-btn-secondary">
              Moderation
            </Link>
            <Link href="/admin/support" className="ui-btn-secondary">
              Support
            </Link>
            <Link href="/admin" className="ui-btn-primary">
              ადმინის მთავარი
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span
            className={
              snapshot.system.aiConfigured
                ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
                : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900"
            }
          >
            {snapshot.system.aiConfigured
              ? "AI API READY"
              : "AI API FALLBACK"}
          </span>
          <span
            className={
              snapshot.dataHealth.ok
                ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
                : "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-800"
            }
          >
            {snapshot.dataHealth.ok ? "DATA HEALTH OK" : "PARTIAL DATA"}
          </span>
          <span
            className={
              snapshot.system.flittProductionReady
                ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
                : "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-800"
            }
          >
            {snapshot.system.flittProductionReady
              ? "FLITT READY"
              : "FLITT CHECK"}
          </span>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="აქტიური განცხადებები" value={snapshot.activeListings} />
        <StatCard label="ღია რეპორტები" value={openReports} />
        <StatCard label="აქტიური Support" value={activeSupport} />
        <StatCard label="30წთ+ Payments" value={snapshot.stalePendingPayments} />
        <StatCard label="Pending Ads" value={snapshot.pendingAds} />
        <StatCard label="Incomplete Stores" value={snapshot.incompleteStores} />
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="ui-eyebrow">Live priority engine</div>
            <h2 className="mt-2 text-2xl font-black text-text">
              რას მივხედოთ ახლა
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-soft">
              ეს სია deterministic წესებით იქმნება live admin მონაცემებიდან;
              AI შემდეგ უკვე ამ ფაქტებს ხსნის და პრიორიტეტიზაციას აზუსტებს.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-800">
              {criticalSignals} critical
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
              {warningSignals} warning
            </span>
          </div>
        </div>

        {snapshot.signals.length ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {snapshot.signals.slice(0, 9).map((signal) => (
              <Link
                key={signal.id}
                href={signal.href}
                className={`rounded-[1.2rem] border p-4 transition hover:-translate-y-0.5 ${signalTone(signal.severity)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-black">{signal.title}</div>
                  <span className="rounded-full border border-current/20 bg-white/60 px-2.5 py-1 text-xs font-black">
                    {signal.count}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 opacity-85">
                  {signal.detail}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
            ამ snapshot-ში operational attention signal არ ჩანს.
          </div>
        )}
      </section>

      {!snapshot.dataHealth.ok ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Copilot-ის მონაცემები ნაწილობრივ ჩაიტვირთა. პრობლემური read-only
          წყაროები: {snapshot.dataHealth.failedSections.join(", ")}.
        </div>
      ) : null}

      <section className="mt-6">
        <AdminAgentClient
          initialSummary={buildFallbackAdminSummary(snapshot)}
          aiConfigured={snapshot.system.aiConfigured}
          generatedAt={snapshot.generatedAt}
        />
      </section>
    </main>
  )
}
