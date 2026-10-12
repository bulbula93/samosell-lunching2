import { requireAdminUser } from "@/lib/auth"
import { loadBuyerLiquidity } from "@/lib/growth/liquidity-server"
import BuyerLiquidityDashboard from "@/components/growth/BuyerLiquidityDashboard"

export const dynamic = "force-dynamic"

export default async function BuyerLiquidityPage({
  searchParams,
}: { searchParams: Promise<{ period?: string }> }) {
  await requireAdminUser("/dashboard")
  const params = await searchParams
  const period = ["today","7","30"].includes(params.period ?? "") ? params.period! : "7"
  const now = new Date()
  const report = await loadBuyerLiquidity(period,now)
  return <BuyerLiquidityDashboard snapshot={report.snapshot} error={report.error}
    period={period} generatedAt={now.toISOString()} />
}
