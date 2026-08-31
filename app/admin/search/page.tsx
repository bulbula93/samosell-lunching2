import Link from "next/link"
import StatCard from "@/components/shared/StatCard"
import { requireAdminUser } from "@/lib/auth"

type QueryMetric = {
  query: string
  searches: number
  avg_results?: number
  zero_result_searches?: number
  clicks?: number
  favorites?: number
  chat_starts?: number
  search_ctr?: number
}

type PositionMetric = {
  position: number
  impressions: number
  clicks: number
  favorites: number
  chat_starts: number
  ctr: number
}

type SearchAnalyticsSummary = {
  days?: number
  ranking_version?: string
  searches?: number
  result_exposures?: number
  zero_result_searches?: number
  zero_result_rate?: number
  searches_with_click?: number
  search_ctr?: number
  result_click_rate?: number
  favorites?: number
  chat_starts?: number
  favorite_rate?: number
  chat_start_rate?: number
  avg_clicked_position?: number
  top_queries?: QueryMetric[]
  zero_result_queries?: QueryMetric[]
  high_intent_queries?: QueryMetric[]
  position_metrics?: PositionMetric[]
}

function number(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function percent(value: unknown) {
  return `${number(value).toLocaleString("ka-GE", { maximumFractionDigits: 2 })}%`
}

function readDays(value?: string | string[]) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : 30
  return parsed === 7 || parsed === 90 ? parsed : 30
}

function queryRows(value: unknown): QueryMetric[] {
  return Array.isArray(value) ? (value as QueryMetric[]) : []
}

function positionRows(value: unknown): PositionMetric[] {
  return Array.isArray(value) ? (value as PositionMetric[]) : []
}

export default async function AdminSearchAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const days = readDays(params.days)
  const { supabase } = await requireAdminUser("/dashboard")
  const { data, error } = await supabase.rpc("get_search_analytics_summary", {
    p_days: days,
  })

  if (error) {
    throw new Error(`search_analytics_failed:${error.message}`)
  }

  const summary = (data ?? {}) as SearchAnalyticsSummary
  const topQueries = queryRows(summary.top_queries)
  const zeroQueries = queryRows(summary.zero_result_queries)
  const highIntentQueries = queryRows(summary.high_intent_queries)
  const positions = positionRows(summary.position_metrics)

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Discovery · Phase 10</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              Search Analytics
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              აქ ჩანს რას ეძებენ, სად ვერ პოულობენ შედეგს და რომელი ძებნა გადადის click, favorite ან chat intent-ში. Ranking-ის წონები ავტომატურად არ იცვლება — ცვლილება ხდება მხოლოდ კონტროლირებადი config version-ით.
            </p>
            <p className="mt-3 text-xs font-bold text-brand">
              Ranking version: {summary.ranking_version || "phase10-v1"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[7, 30, 90].map((value) => (
              <Link
                key={value}
                href={`/admin/search?days=${value}`}
                className={days === value ? "ui-btn-primary" : "ui-btn-secondary"}
              >
                {value} დღე
              </Link>
            ))}
            <Link href="/admin" className="ui-btn-secondary">ადმინზე დაბრუნება</Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Searches" value={number(summary.searches)} />
        <StatCard label="Zero-result rate" value={percent(summary.zero_result_rate)} />
        <StatCard label="Search CTR" value={percent(summary.search_ctr)} />
        <StatCard label="Result click rate" value={percent(summary.result_click_rate)} />
        <StatCard label="Favorites from search" value={number(summary.favorites)} />
        <StatCard label="Favorite / search" value={percent(summary.favorite_rate)} />
        <StatCard label="Chats from search" value={number(summary.chat_starts)} />
        <StatCard label="Chat / search" value={percent(summary.chat_start_rate)} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="ui-card overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <div className="ui-eyebrow">Demand</div>
            <h2 className="mt-2 text-xl font-black text-text">ყველაზე ხშირი ძებნები</h2>
          </div>
          {topQueries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-surface-alt text-xs text-text-soft">
                  <tr>
                    <th className="px-5 py-3">Query</th>
                    <th className="px-4 py-3">Searches</th>
                    <th className="px-4 py-3">Avg results</th>
                    <th className="px-4 py-3">CTR</th>
                    <th className="px-4 py-3">Fav</th>
                    <th className="px-4 py-3">Chat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {topQueries.map((row) => (
                    <tr key={row.query}>
                      <td className="px-5 py-3 font-bold text-text">{row.query}</td>
                      <td className="px-4 py-3">{number(row.searches)}</td>
                      <td className="px-4 py-3">{number(row.avg_results)}</td>
                      <td className="px-4 py-3">{percent(row.search_ctr)}</td>
                      <td className="px-4 py-3">{number(row.favorites)}</td>
                      <td className="px-4 py-3">{number(row.chat_starts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-6 py-10 text-sm text-text-soft">ამ პერიოდში search მონაცემი ჯერ არ დაგროვებულა.</p>
          )}
        </div>

        <div className="ui-card overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <div className="ui-eyebrow">Coverage gaps</div>
            <h2 className="mt-2 text-xl font-black text-text">Zero-result queries</h2>
          </div>
          {zeroQueries.length ? (
            <div className="divide-y divide-line">
              {zeroQueries.map((row) => (
                <div key={row.query} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                  <span className="min-w-0 truncate font-bold text-text">{row.query}</span>
                  <span className="shrink-0 text-sm text-text-soft">{number(row.searches)} ძებნა</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-10 text-sm text-text-soft">ამ პერიოდში zero-result query არ დაფიქსირებულა.</p>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="ui-card overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <div className="ui-eyebrow">Intent</div>
            <h2 className="mt-2 text-xl font-black text-text">High-intent queries</h2>
          </div>
          {highIntentQueries.length ? (
            <div className="divide-y divide-line">
              {highIntentQueries.map((row) => (
                <div key={row.query} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-4 px-5 py-4 sm:px-6">
                  <span className="truncate font-bold text-text">{row.query}</span>
                  <span className="text-xs text-text-soft">Clicks {number(row.clicks)}</span>
                  <span className="text-xs text-text-soft">Fav {number(row.favorites)}</span>
                  <span className="text-xs font-bold text-brand">Chat {number(row.chat_starts)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-10 text-sm text-text-soft">favorite/chat conversion ჯერ არ დაგროვებულა.</p>
          )}
        </div>

        <div className="ui-card overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <div className="ui-eyebrow">Ranking diagnostics</div>
            <h2 className="mt-2 text-xl font-black text-text">პოზიციის CTR · პირველი გვერდი</h2>
            <p className="mt-2 text-xs leading-5 text-text-soft">
              საშუალო დაჭერილი პოზიცია: {number(summary.avg_clicked_position).toLocaleString("ka-GE", { maximumFractionDigits: 1 })}
            </p>
          </div>
          {positions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-surface-alt text-xs text-text-soft">
                  <tr>
                    <th className="px-5 py-3">Position</th>
                    <th className="px-4 py-3">Impressions</th>
                    <th className="px-4 py-3">Clicks</th>
                    <th className="px-4 py-3">CTR</th>
                    <th className="px-4 py-3">Chat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {positions.map((row) => (
                    <tr key={row.position}>
                      <td className="px-5 py-3 font-bold">#{row.position}</td>
                      <td className="px-4 py-3">{number(row.impressions)}</td>
                      <td className="px-4 py-3">{number(row.clicks)}</td>
                      <td className="px-4 py-3">{percent(row.ctr)}</td>
                      <td className="px-4 py-3">{number(row.chat_starts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-6 py-10 text-sm text-text-soft">პოზიციის მონაცემები ჯერ არ არის.</p>
          )}
        </div>
      </section>
    </main>
  )
}
