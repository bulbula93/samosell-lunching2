import Link from "next/link"
import StatCard from "@/components/shared/StatCard"
import { requireAdminUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { deleteSearchAliasAction, upsertSearchAliasAction } from "./actions"

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

type SearchAlias = {
  id: number
  canonical_term: string
  alias: string
  kind: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type SearchExperiment = {
  id: string
  name: string
  control_version: string
  treatment_version: string
  treatment_percent: number
  status: string
  starts_at?: string | null
  ends_at?: string | null
  created_at: string
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

function aliasRows(value: unknown): SearchAlias[] {
  return Array.isArray(value) ? (value as SearchAlias[]) : []
}

function experimentRows(value: unknown): SearchExperiment[] {
  return Array.isArray(value) ? (value as SearchExperiment[]) : []
}

function aliasKindLabel(kind: string) {
  switch (kind) {
    case "transliteration":
      return "ტრანსლიტერაცია"
    case "brand":
      return "ბრენდი"
    case "category":
      return "კატეგორია"
    default:
      return "სინონიმი"
  }
}

export default async function AdminSearchAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const days = readDays(params.days)
  const { user } = await requireAdminUser("/dashboard")
  const admin = createAdminClient()

  const [analyticsResponse, aliasesResponse, experimentsResponse] = await Promise.all([
    admin.rpc("get_search_analytics_summary_service", { p_actor_id: user.id, p_days: days }),
    admin.rpc("admin_list_search_aliases_service", { p_actor_id: user.id }),
    admin.rpc("admin_list_search_experiments_service", { p_actor_id: user.id }),
  ])

  if (analyticsResponse.error) {
    throw new Error(`search_analytics_failed:${analyticsResponse.error.message}`)
  }
  if (aliasesResponse.error) {
    throw new Error(`search_aliases_failed:${aliasesResponse.error.message}`)
  }
  if (experimentsResponse.error) {
    throw new Error(`search_experiments_failed:${experimentsResponse.error.message}`)
  }

  const summary = (analyticsResponse.data ?? {}) as SearchAnalyticsSummary
  const topQueries = queryRows(summary.top_queries)
  const zeroQueries = queryRows(summary.zero_result_queries)
  const highIntentQueries = queryRows(summary.high_intent_queries)
  const positions = positionRows(summary.position_metrics)
  const aliases = aliasRows(aliasesResponse.data)
  const experiments = experimentRows(experimentsResponse.data)
  const runningExperiment = experiments.find((item) => item.status === "running") ?? null

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Discovery · Phase 11A</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              Search Quality Lab
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              Phase 10-ის analytics აქ რჩება, ხოლო Phase 11A ამატებს zero-result rescue-ს, სინონიმებს, Latin→Georgian transliteration-ს და A/B ranking-ის უსაფრთხო scaffold-ს. Ranking weight-ები თვითონ არ იცვლება.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-brand-soft px-3 py-1.5 text-brand">
                Ranking: {summary.ranking_version || "phase10-v1"}
              </span>
              <span className="rounded-full bg-surface-alt px-3 py-1.5 text-text-soft">
                Alias rules: {aliases.length}
              </span>
              <span className="rounded-full bg-surface-alt px-3 py-1.5 text-text-soft">
                A/B: {runningExperiment ? runningExperiment.name : "გამორთულია"}
              </span>
            </div>
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

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="ui-card p-5 sm:p-6">
          <div className="ui-eyebrow">Query dictionary</div>
          <h2 className="mt-2 text-xl font-black text-text">სინონიმის / alias-ის დამატება</h2>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            Rescue მხოლოდ მაშინ იყენებს ამ წესებს, როცა ძირითადი relevance search-ს შედეგი არ აქვს. ერთი alias ერთ canonical მნიშვნელობაზეა მიბმული.
          </p>

          <form action={upsertSearchAliasAction} className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-text">
              Canonical მნიშვნელობა
              <input
                name="canonicalTerm"
                required
                maxLength={120}
                placeholder="მაგ. ჰუდი"
                className="ui-input"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-text">
              Alias / სხვა ჩანაწერი
              <input
                name="alias"
                required
                maxLength={120}
                placeholder="მაგ. hoodie"
                className="ui-input"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-text">
              ტიპი
              <select name="kind" defaultValue="synonym" className="ui-input">
                <option value="synonym">სინონიმი</option>
                <option value="transliteration">ტრანსლიტერაცია</option>
                <option value="brand">ბრენდი</option>
                <option value="category">კატეგორია</option>
              </select>
            </label>
            <button type="submit" className="ui-btn-primary justify-center">წესის შენახვა</button>
          </form>
        </div>

        <div className="ui-card overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <div className="ui-eyebrow">Active dictionary</div>
            <h2 className="mt-2 text-xl font-black text-text">Search aliases</h2>
          </div>
          {aliases.length ? (
            <div className="max-h-[520px] divide-y divide-line overflow-y-auto">
              {aliases.map((item) => (
                <div key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate font-black text-text">{item.alias}</span>
                      <span className="text-text-soft">→</span>
                      <span className="truncate font-bold text-brand">{item.canonical_term}</span>
                    </div>
                    <span className="mt-1 inline-flex rounded-full bg-surface-alt px-2 py-1 text-[11px] font-bold text-text-soft">
                      {aliasKindLabel(item.kind)}
                    </span>
                  </div>
                  <form action={deleteSearchAliasAction}>
                    <input type="hidden" name="aliasId" value={item.id} />
                    <button type="submit" className="ui-btn-ghost text-xs">წაშლა</button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-10 text-sm text-text-soft">Alias dictionary ცარიელია.</p>
          )}
        </div>
      </section>

      <section className="mt-6 ui-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">A/B scaffold</div>
            <h2 className="mt-2 text-xl font-black text-text">Ranking experiments</h2>
            <p className="mt-2 text-sm leading-6 text-text-soft">
              Assignment infrastructure მზადაა, მაგრამ experiment შეგნებულად არ ირთვება treatment ranking version-ის შექმნამდე. Signed-in მომხმარებელზე variant სტაბილურად ნაწილდება account-ის მიხედვით; anonymous search-ზე — search impression-ის მიხედვით, fingerprint-ის გარეშე.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-black ${runningExperiment ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
            {runningExperiment ? `RUNNING · ${runningExperiment.name}` : "NO ACTIVE EXPERIMENT"}
          </span>
        </div>

        {experiments.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface-alt text-xs text-text-soft">
                <tr>
                  <th className="px-4 py-3">Experiment</th>
                  <th className="px-4 py-3">Control</th>
                  <th className="px-4 py-3">Treatment</th>
                  <th className="px-4 py-3">Split</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {experiments.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-bold text-text">{item.name}</td>
                    <td className="px-4 py-3">{item.control_version}</td>
                    <td className="px-4 py-3">{item.treatment_version}</td>
                    <td className="px-4 py-3">{100 - number(item.treatment_percent)} / {number(item.treatment_percent)}</td>
                    <td className="px-4 py-3 font-bold uppercase">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-line bg-surface-alt px-5 py-4 text-sm text-text-soft">
            Experiment ჯერ არ შექმნილა. Phase 11B-ში treatment ranking version-ს რეალურ Phase 10 მონაცემებზე ავაწყობთ და მხოლოდ შემდეგ ჩავრთავთ split-test-ს.
          </p>
        )}
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
