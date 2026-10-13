// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fixture = vi.hoisted(() => ({ clients: [] as Array<{ count?: unknown; signals: AbortSignal[] }>, responses: [] as unknown[] }))
vi.mock("next/cache", () => ({ unstable_cache: (loader: unknown) => loader }))
vi.mock("@/lib/supabase/public-server", () => ({
  createPublicServerClient: () => {
    const record = { signals: [] as AbortSignal[], count: undefined as unknown }
    fixture.clients.push(record)
    const query = {
      select: (_fields: string, options?: { count?: unknown }) => { record.count = options?.count; return query },
      eq: () => query, order: () => query, limit: () => query,
      abortSignal: (signal: AbortSignal) => {
        record.signals.push(signal)
        const response = fixture.responses.shift()
        if (response === "hang") return new Promise(resolve => signal.addEventListener("abort", () => resolve({ error: { message: "aborted" } }), { once: true }))
        return Promise.resolve(response)
      },
    }
    return { from: () => query }
  },
}))
import { getPublicHomePageData } from "@/lib/home-page"

beforeEach(() => { fixture.clients.length = 0; fixture.responses.length = 0 })
afterEach(() => vi.useRealTimers())

describe("Actual home data loader with isolated PostgREST failures", () => {
  it("recovers with a fresh client and no exact count, preserving real listing data", async () => {
    fixture.responses.push({ error: { message: "transient timeout" } }, { error: null, data: [{ id: "real-row", slug: "real-row", status: "active", published_at: "2026-10-01", price: 10 }] })
    const result = await getPublicHomePageData()
    expect(result.latestItems.map(item => item.id)).toEqual(["real-row"])
    expect(result.activeCount).toBe(1)
    expect(fixture.clients).toHaveLength(2)
    expect(fixture.clients[0].count).toBe("exact")
    expect(fixture.clients[1].count).toBeUndefined()
  })

  it("throws on two failures so no fabricated empty data can enter the cache loader", async () => {
    fixture.responses.push({ error: { message: "first failure" } }, { error: { message: "retry failure" } })
    await expect(getPublicHomePageData()).rejects.toThrow("home_public_data_unavailable:retry failure")
    expect(fixture.clients).toHaveLength(2)
  })

  it("cancels both hanging requests within the 15s + 6s budget and retries only once", async () => {
    vi.useFakeTimers()
    fixture.responses.push("hang", "hang")
    const result = getPublicHomePageData()
    const assertion = expect(result).rejects.toThrow("home_public_data_unavailable")
    await vi.advanceTimersByTimeAsync(21_010)
    await assertion
    expect(fixture.clients).toHaveLength(2)
    expect(fixture.clients.every(client => client.signals[0].aborted)).toBe(true)
  })

  it("does not retry successful empty inventory or a successful primary read", async () => {
    fixture.responses.push({ error: null, data: [], count: 0 })
    expect((await getPublicHomePageData()).activeCount).toBe(0)
    expect(fixture.clients).toHaveLength(1)
  })
})
