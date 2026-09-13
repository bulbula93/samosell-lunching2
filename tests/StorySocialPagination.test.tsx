import { render, screen } from "@testing-library/react"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"
import { getStoryRailData } from "@/lib/story-data"
import SocialListPage from "@/app/seller/[username]/SocialListPage"

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }))
vi.mock("@/components/layout/SiteHeader", () => ({ default: () => null }))

type Row = Record<string, unknown>
function database(tables: Record<string, Row[]>) {
  const queries: Array<{ table: string; selection: string; filters: string[]; from: number; to: number }> = []
  return {
    queries,
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const log = { table, selection: "", filters: [] as string[], from: 0, to: Infinity }
      queries.push(log)
      const query = {
        select(selection: string) { log.selection = selection; return query },
        eq(column: string, value: unknown) {
          log.filters.push(column)
          rows = rows.filter(row => {
            const [key, nested] = column.split(".")
            return (nested ? (row[key] as Row)?.[nested] : row[key]) === value
          })
          return query
        },
        in(column: string, values: unknown[]) { rows = rows.filter(row => values.includes(row[column])); return query },
        is() { return query }, gt() { return query }, lte() { return query },
        order() { return query }, or() { return query },
        range(from: number, to: number) { log.from = from; log.to = to; return query },
        limit(limit: number) { log.to = limit - 1; return query },
        maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }) },
        then(resolve: (result: { data: Row[]; error: null; count: number }) => unknown) {
          return Promise.resolve(resolve({ data: rows.slice(log.from, log.to + 1), error: null, count: rows.length }))
        },
      }
      return query
    },
  }
}

describe("Story ranking and social pagination", () => {
  it("ranks own and followed older Stories beyond 240 and 1000 candidates", async () => {
    const ids = [...Array.from({ length: 1001 }, (_, i) => `new-${i}`), "followed", "self"]
    const db = database({
      stories: ids.map((id, i) => ({ id, user_id: id, created_at: new Date(Date.now() - i * 1000).toISOString(), media_type: "image", expires_at: new Date(Date.now() + 3600000).toISOString() })),
      profiles: ids.map(id => ({ id, username: id, is_suspended: false })),
      user_follows: [{ follower_id: "self", following_id: "followed" }],
    })
    const result = await getStoryRailData(db as unknown as SupabaseClient, { id: "self" } as User)
    expect(result.owners).toHaveLength(24)
    expect(result.owners.slice(0, 2).map(owner => owner.id)).toEqual(["self", "followed"])
    expect(db.queries.filter(q => q.table === "stories").map(q => q.from)).toEqual([0, 240, 480, 720, 960])
    expect(result.currentUsername).toBe("self")
  })

  it.each(["followers", "following"] as const)("excludes suspended %s before count and range", async mode => {
    const relation = mode === "followers" ? "follower" : "following"
    const column = mode === "followers" ? "following_id" : "follower_id"
    const db = database({
      profiles: [{ id: "owner", username: "owner", is_suspended: false }],
      user_follows: Array.from({ length: 25 }, (_, i) => ({ [column]: "owner", [relation]: { id: `person-${i}`, username: `person-${i}`, is_suspended: i < 24 } })),
    })
    mocks.createClient.mockResolvedValue(db)
    render(await SocialListPage({ username: "owner", page: 1, mode }))
    expect(screen.getByText("@person-24")).toBeInTheDocument()
    expect(screen.queryByText("სია ჯერ ცარიელია")).not.toBeInTheDocument()
    expect(screen.queryByText("შემდეგი")).not.toBeInTheDocument()
    const query = db.queries.find(q => q.table === "user_follows")!
    expect(query.selection).toContain("!inner(")
    expect(query.filters).toContain(`${relation}.is_suspended`)
  })
})
