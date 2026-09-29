import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import {
  buildFallbackAdminSummary,
  collectAdminAgentSnapshot,
  type AdminAgentSeverity,
} from "@/lib/admin-agent"
import AdminAgentClient from "@/components/admin/AdminAgentClient"
import StatCard from "@/components/shared/StatCard"

function severityClass(severity: AdminAgentSeverity) {
  switch (severity) {
    case "critical":
      return "border-red-300 bg-red-50 text-red-950"
    case "high":
      return "border-amber-300 bg-amber-50 text-amber-950"
    case "medium":
      return "border-sky-200 bg-sky-50 text-sky-950"
    case "low":
      return "border-line bg-surface-alt text-text"
  }
}

function severityLabel(severity: AdminAgentSeverity) {
  switch (severity) {
    case "critical": return "CRITICAL"
    case "high": return "HIGH"
    case "medium": return "MEDIUM"
    case "low": return "LOW"
  }
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminAgentPage() {
  const { supabase } = await requireAdminUser("/dashboard")
  const snapshot = await collectAdminAgentSnapshot(supabase)
  const openReports = snapshot.openListingReports + snapshot.openUserReports
  const aiEnabled = Boolean(String(process.env.OPENAI_API_KEY ?? "").trim())

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
              Read-only AI ადმინისტრატორი აანალიზებს Payments, Moderation, Support, Listings,
              Stores და ოპერაციულ backlog-ს. ამ ფაზაში მას ცვლილების, წაშლის, suspend-ის,
              refund-ის ან payment approval-ის უფლება არ აქვს.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className={
              aiEnabled
                ? "rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800"
                : "rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900"
            }>
              {aiEnabled ? "AI mode: READY" : "AI mode: FALLBACK"}
            </span>
            <Link href="/admin" className="ui-btn-secondary">
              ადმინისტრირების პანელი
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="აქტიური განცხადებები" value={snapshot.activeListings} />
        <StatCard label="ღია რეპორტები" value={openReports} />
        <StatCard label="24სთ+ რეპორტები" value={snapshot.overdueReports24h} />
        <StatCard label="Support ღია" value={snapshot.openSupportTickets + snapshot.reviewingSupportTickets} />
        <StatCard label="Flitt stale" value={snapshot.stalePendingPayments} />
        <StatCard label="არასრული მაღაზიები" value={snapshot.incompleteStores} />
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="ui-eyebrow">Live priorities</div>
            <h2 className="mt-2 text-2xl font-black text-text">რა ითხოვს ყურადღებას ახლა</h2>
            <p className="mt-2 text-sm leading-6 text-text-soft">
              ეს სია deterministic წესებით იქმნება production მონაცემებიდან და AI-ის პასუხზე დამოკიდებული არ არის.
            </p>
          </div>
          <div className="text-sm text-text-soft">
            {snapshot.signals.length} signal
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {snapshot.signals.length ? snapshot.signals.slice(0, 8).map((signal) => (
            <article
              key={signal.id}
              className={`rounded-[1.2rem] border p-4 ${severityClass(signal.severity)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black tracking-wide">
                    {severityLabel(signal.severity)} · {signal.kind.toUpperCase()}
                  </div>
                  <h3 className="mt-2 font-black">{signal.title}</h3>
                  <p className="mt-2 text-sm leading-6 opacity-80">{signal.detail}</p>
                  {signal.entityId ? (
                    <div className="mt-2 break-all font-mono text-[11px] opacity-70">
                      ID: {signal.entityId}
                    </div>
                  ) : null}
                </div>
                <Link href={signal.href} className="ui-btn-secondary shrink-0">
                  გახსნა
                </Link>
              </div>
            </article>
          )) : (
            <div className="rounded-[1.2rem] border border-dashed border-line p-6 text-sm text-text-soft lg:col-span-2">
              ამ snapshot-ში მაღალი პრიორიტეტის ოპერაციული signal არ ჩანს.
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="ui-card p-5">
          <div className="ui-eyebrow">Payments</div>
          <div className="mt-2 text-2xl font-black text-text">
            {snapshot.approvedPayments}/{snapshot.realLivePayments}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            approved / real LIVE · pending {snapshot.pendingPayments} · failed {snapshot.failedPayments}
          </p>
          <Link href="/admin/payments" className="ui-btn-secondary mt-4">გადახდები</Link>
        </div>

        <div className="ui-card p-5">
          <div className="ui-eyebrow">Moderation</div>
          <div className="mt-2 text-2xl font-black text-text">{openReports}</div>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            ღია რეპორტები · 24სთ+ backlog {snapshot.overdueReports24h}
          </p>
          <Link href="/admin/reports" className="ui-btn-secondary mt-4">რეპორტები</Link>
        </div>

        <div className="ui-card p-5">
          <div className="ui-eyebrow">Support</div>
          <div className="mt-2 text-2xl font-black text-text">
            {snapshot.openSupportTickets + snapshot.reviewingSupportTickets}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            active tickets · high priority {snapshot.highPrioritySupportTickets}
          </p>
          <Link href="/admin/support" className="ui-btn-secondary mt-4">Support Inbox</Link>
        </div>

        <div className="ui-card p-5">
          <div className="ui-eyebrow">Stores</div>
          <div className="mt-2 text-2xl font-black text-text">{snapshot.totalStores}</div>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            verified {snapshot.verifiedStores} · incomplete {snapshot.incompleteStores}
          </p>
          <Link href="/admin/stores" className="ui-btn-secondary mt-4">მაღაზიები</Link>
        </div>
      </section>

      <section className="mt-6">
        <AdminAgentClient
          initialSummary={buildFallbackAdminSummary(snapshot)}
          aiEnabled={aiEnabled}
        />
      </section>
    </main>
  )
}
