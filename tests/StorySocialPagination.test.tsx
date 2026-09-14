import { render, screen } from "@testing-library/react"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"
import { getFollowSummary, getStoryRailData } from "@/lib/story-data"
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
            return column.split(".").reduce<unknown>((value, key) => (value as Row)?.[key], row) === value
          })
          return query
        },
        in(column: string, values: unknown[]) { rows = rows.filter(row => values.includes(row[column])); return query },
        is(column: string, value: unknown) { rows = rows.filter(row => row[column] === value); return query },
        gt(column: string, value: string) { rows = rows.filter(row => String(row[column]) > value); return query },
        lte(column: string, value: string) { rows = rows.filter(row => String(row[column]) <= value); return query },
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
      stories: ids.map((id, i) => ({ id, user_id: id, deleted_at: null, owner: { is_suspended: false, follows: { follower_id: id === "followed" ? "self" : "other" } }, created_at: new Date(Date.now() - i * 1000).toISOString(), media_type: "image", expires_at: new Date(Date.now() + 3600000).toISOString() })),
      profiles: ids.map(id => ({ id, username: id, is_suspended: false })),
      user_follows: [{ follower_id: "self", following_id: "followed" }],
    })
    const result = await getStoryRailData(db as unknown as SupabaseClient, { id: "self" } as User)
    expect(result.owners).toHaveLength(24)
    expect(result.owners.slice(0, 2).map(owner => owner.id)).toEqual(["self", "followed"])
    expect(db.queries.filter(q => q.table === "stories").map(q => q.to + 1)).toEqual([240, 10, 240])
    expect(result.owners.every(owner => owner.storyCount === 1)).toBe(true)
    expect(result.currentUsername).toBe("self")
  })

  it("bounds anonymous discovery and excludes suspended, deleted and expired candidates", async () => {
    const story = { created_at: new Date(Date.now() - 1000).toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), deleted_at: null, media_type: "image", owner: { is_suspended: false } }
    const ids = Array.from({ length: 10000 }, (_, i) => `active-${i}`)
    const db = database({ stories: [
      { ...story, id: "suspended", user_id: "suspended", owner: { is_suspended: true } },
      { ...story, id: "deleted", user_id: "deleted", deleted_at: new Date().toISOString() },
      { ...story, id: "expired", user_id: "expired", expires_at: "2000-01-01" },
      ...ids.map(id => ({ ...story, id, user_id: id })),
    ], profiles: [...ids, "suspended", "deleted", "expired"].map(id => ({ id, username: id, is_suspended: id === "suspended" })) })
    const result = await getStoryRailData(db as unknown as SupabaseClient, null)
    expect(result.owners).toHaveLength(24)
    expect(result.owners.every(owner => owner.id.startsWith("active-"))).toBe(true)
    expect(db.queries.filter(q => q.table === "stories")).toHaveLength(1)
    expect(db.queries.filter(q => q.table === "profiles")).toHaveLength(3)
  })

  it("counts only active accounts in both directions and reflects unfollow", async () => {
    const relationships = [
      { follower_id: "active", following_id: "self", follower: { is_suspended: false } },
      { follower_id: "suspended", following_id: "self", follower: { is_suspended: true } },
      { follower_id: "self", following_id: "active", following: { is_suspended: false } },
      { follower_id: "self", following_id: "suspended", following: { is_suspended: true } },
    ]
    const db = database({ user_follows: relationships })
    expect(await getFollowSummary(db as unknown as SupabaseClient, "self", "active")).toEqual({ followers: 1, following: 1, isFollowing: true })
    relationships.splice(0, 1)
    expect(await getFollowSummary(db as unknown as SupabaseClient, "self", "active")).toEqual({ followers: 0, following: 1, isFollowing: false })
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
