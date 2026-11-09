import { requireAdminUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { growthPeriod } from "@/lib/growth/shared"
import { growthWritesEnabled } from "@/lib/growth/server"
import type { GrowthSummary } from "@/lib/growth/dashboard"
import GrowthDashboard from "@/components/growth/GrowthDashboard"
import { readMetaSpend, metaSpendConfigurationStatus } from "@/lib/growth/meta-spend-server"
import { LISTING_SHARE_ACTIONS, type ListingShareAction } from "@/lib/facebook-community"
export default async function GrowthPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { user } = await requireAdminUser("/dashboard")
  const params = await searchParams
  const period = ["today", "7", "30"].includes(params.period ?? "") ? params.period! : "7"
  const now = new Date()
  const range = growthPeriod(period, now)
  const metaSpendPromise = readMetaSpend(period, now)
  let summary: GrowthSummary | null = null
  let shares: Partial<Record<ListingShareAction, number>> | null = null
  let unavailable = "Growth migration / tracking ჯერ არ არის გააქტიურებული."
  if (growthWritesEnabled()) {
    try {
      const db = createAdminClient()
      const [{ data, error }, shareResult] = await Promise.all([
        db.rpc("get_growth_summary", { p_actor_id: user.id, p_from: range.from, p_to: range.to }),
        db.rpc("get_listing_share_summary", { p_actor_id: user.id, p_from: range.from, p_to: range.to }),
      ])
      if (!shareResult.error && shareResult.data) shares = shareResult.data
      if (!error && data) summary = data as GrowthSummary
      else unavailable = "Growth მონაცემების წაკითხვა ვერ მოხერხდა. სცადე მოგვიანებით."
    } catch { unavailable = "Growth მონაცემების კავშირი ჯერ არ არის მზად." }
  }
  const labels: Record<ListingShareAction, string> = { facebook_share_clicked: "Facebook გაზიარებაზე დაჭერა", post_copied: "ჯგუფისთვის ტექსტის კოპირება", link_copied: "ბმულის კოპირება", group_open_clicked: "ჯგუფის გახსნაზე დაჭერა" }
  return <>
    <GrowthDashboard generatedAt={now.toISOString()} summary={summary} period={period} unavailable={unavailable} metaSpend={await metaSpendPromise} metaConfigurationIssue={metaSpendConfigurationStatus()} />
    <section className="ui-container pb-8" aria-labelledby="facebook-share-analytics">
      <div className="ui-card p-5">
        <h2 id="facebook-share-analytics" className="text-lg font-black text-text">Facebook Community — მოქმედებები</h2>
        <p className="mt-2 text-sm text-text-soft">არჩეული პერიოდი · მხოლოდ ანალიტიკაზე თანხმობის მქონე ვიზიტორები. ეს მოქმედებები Facebook პოსტის გამოქვეყნებას არ ადასტურებს.</p>
        {shares ? <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{LISTING_SHARE_ACTIONS.map(action => <div key={action} className="rounded-xl bg-surface-alt p-3"><dt className="text-sm text-text-soft">{labels[action]}</dt><dd className="mt-1 text-2xl font-black text-text">{shares[action] ?? 0}</dd></div>)}</dl>
          : <p className="mt-3 text-sm text-text-soft">გაზიარების ანალიტიკა ჯერ მიუწვდომელია — საჭიროა migration და ანალიტიკის ჩართული იზოლირებული გარემო.</p>}
      </div>
    </section>
  </>
}
