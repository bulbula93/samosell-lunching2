import { requireAdminUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { growthPeriod } from "@/lib/growth/shared"
import { growthWritesEnabled } from "@/lib/growth/server"
import type { GrowthSummary } from "@/lib/growth/dashboard"
import GrowthDashboard from "@/components/growth/GrowthDashboard"
import { readMetaSpend, metaSpendConfigurationStatus } from "@/lib/growth/meta-spend-server"
export default async function GrowthPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { user } = await requireAdminUser("/dashboard")
  const params = await searchParams
  const period = ["today", "7", "30"].includes(params.period ?? "") ? params.period! : "7"
  const now = new Date()
  const range = growthPeriod(period, now)
  const metaSpendPromise = readMetaSpend(period, now)
  let summary: GrowthSummary | null = null
  let unavailable = "Growth migration / tracking ჯერ არ არის გააქტიურებული."
  if (growthWritesEnabled()) {
    try {
      const { data, error } = await createAdminClient().rpc("get_growth_summary", { p_actor_id: user.id, p_from: range.from, p_to: range.to })
      if (!error && data) summary = data as GrowthSummary
      else unavailable = "Growth მონაცემების წაკითხვა ვერ მოხერხდა. სცადე მოგვიანებით."
    } catch { unavailable = "Growth მონაცემების კავშირი ჯერ არ არის მზად." }
  }
  return <GrowthDashboard summary={summary} period={period} unavailable={unavailable} metaSpend={await metaSpendPromise} metaConfigurationIssue={metaSpendConfigurationStatus()} />
}
