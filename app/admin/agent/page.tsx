import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import { buildFallbackAdminSummary, collectAdminAgentSnapshot } from "@/lib/admin-agent"
import AdminAgentClient from "@/components/admin/AdminAgentClient"
import StatCard from "@/components/shared/StatCard"

export default async function AdminAgentPage() {
  const { supabase } = await requireAdminUser("/dashboard")
  const snapshot = await collectAdminAgentSnapshot(supabase)
  const openReports = snapshot.openListingReports + snapshot.openUserReports
  const reviewingReports = snapshot.reviewingListingReports + snapshot.reviewingUserReports

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">AI ადმინისტრირება</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">SamoSell Admin Agent</h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              პირველი ვერსია არის read-only: აგენტი ხედავს მხოლოდ აგრეგირებულ ადმინისტრაციულ მეტრიკებს, აწყობს პრიორიტეტებს და გთავაზობს შემდეგ ნაბიჯებს. ცვლილებების შესრულება ავტომატურად გამორთულია.
            </p>
          </div>
          <Link href="/admin" className="ui-btn-secondary">ადმინისტრირების პანელი</Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="აქტიური განცხადებები" value={snapshot.activeListings} />
        <StatCard label="ღია რეპორტები" value={openReports} />
        <StatCard label="დამუშავებაში" value={reviewingReports} />
        <StatCard label="VIP მოლოდინში" value={snapshot.pendingBoosts} />
      </section>

      <section className="mt-6">
        <AdminAgentClient initialSummary={buildFallbackAdminSummary(snapshot)} />
      </section>
    </main>
  )
}
