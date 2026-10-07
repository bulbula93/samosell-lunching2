import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import {
  buildFallbackGrowthSummary,
  collectGrowthSnapshot,
} from "@/lib/growth-agent"
import GrowthAgentClient from "@/components/admin/GrowthAgentClient"
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

export default async function AdminGrowthPage() {
  await requireAdminUser("/dashboard")
  const snapshot = await collectGrowthSnapshot()

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Growth / Seller acquisition / v1</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              SamoSell Growth Agent
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              Live marketplace KPI-ებზე აგებული seller-acquisition copilot.
              ამ ფაზაში თვითონ ზომავს supply-ს, seller activation-ს და demand
              signal-ებს, შემდეგ კი კონკრეტულ კამპანიებსა და კონტენტს გთავაზობს.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin/agent" className="ui-btn-secondary">
              Admin Copilot
            </Link>
            <Link href="/admin/search" className="ui-btn-secondary">
              Search Analytics
            </Link>
            <Link href="/admin" className="ui-btn-primary">
              ადმინის მთავარი
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span
            className={
              snapshot.aiConfigured
                ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
                : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900"
            }
          >
            {snapshot.aiConfigured ? "AI API READY" : "AI API FALLBACK"}
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
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-900">
            TARGET 1,000 LISTINGS
          </span>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="აქტიური განცხადებები" value={snapshot.activeListings} />
        <StatCard label="Listings / 24სთ" value={snapshot.listings24h} />
        <StatCard label="Listings / 7 დღე" value={snapshot.listings7d} />
        <StatCard label="Activated sellers" value={snapshot.activatedSellers} />
        <StatCard label="Warm sellers" value={snapshot.warmSellers} />
        <StatCard label="Chats / 7 დღე" value={snapshot.chats7d} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="ui-card p-5 sm:p-6">
          <div className="ui-eyebrow">30-დღიანი pace</div>
          <div className="mt-2 text-3xl font-black text-text">
            {snapshot.dailyListingTarget}/დღე
          </div>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            1,000 აქტიურ განცხადებამდე დარჩენილია {snapshot.gapToTarget}.
            ეს არის მიმდინარე gap-ის თანაბრად გადანაწილებული სამიზნე 30 დღეზე.
          </p>
        </div>

        <div className="ui-card p-5 sm:p-6">
          <div className="ui-eyebrow">Seller activation</div>
          <div className="mt-2 text-3xl font-black text-text">
            {snapshot.activationRatePct}%
          </div>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            {snapshot.sellersWithActiveListings} seller-ს აქვს მინიმუმ ერთი
            აქტიური განცხადება; {snapshot.activatedSellers}-ს — 3 ან მეტი.
          </p>
        </div>

        <div className="ui-card p-5 sm:p-6">
          <div className="ui-eyebrow">7-დღიანი outcome</div>
          <div className="mt-2 text-3xl font-black text-text">
            {snapshot.sold7d} sold
          </div>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            ბოლო 7 დღეში {snapshot.newProfiles7d} ახალი profile,
            {" "}{snapshot.listings7d} ახალი non-draft listing და
            {" "}{snapshot.chats7d} ახალი chat.
          </p>
        </div>
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <div>
          <div className="ui-eyebrow">Growth priority engine</div>
          <h2 className="mt-2 text-2xl font-black text-text">
            სად არის bottleneck ახლა
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            ეს სიგნალები deterministic წესებით იქმნება რეალური aggregate
            marketplace მონაცემებიდან. AI ამ ფაქტებზე დაყრდნობით აწყობს
            კამპანიებსა და ექსპერიმენტებს.
          </p>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {snapshot.signals.map((signal) => (
            <Link
              key={signal.id}
              href={signal.href}
              className={
                "rounded-[1.2rem] border p-4 transition hover:-translate-y-0.5 " +
                signalTone(signal.severity)
              }
            >
              <div className="font-black">{signal.title}</div>
              <p className="mt-2 text-xs leading-5 opacity-85">
                {signal.detail}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {!snapshot.dataHealth.ok ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Growth snapshot ნაწილობრივ ჩაიტვირთა. პრობლემური წყაროები:{" "}
          {snapshot.dataHealth.failedSections.join(", ")}.
        </div>
      ) : null}

      <section className="mt-6">
        <GrowthAgentClient
          initialSummary={buildFallbackGrowthSummary(snapshot)}
          aiConfigured={snapshot.aiConfigured}
          generatedAt={snapshot.generatedAt}
        />
      </section>
    </main>
  )
}
