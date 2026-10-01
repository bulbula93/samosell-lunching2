import { afterEach, describe, expect, it, vi } from "vitest"
import { withQueryTimeout } from "@/lib/supabase/query-timeout"

describe("PostgREST query deadline", () => {
  afterEach(() => vi.useRealTimers())

  it("aborts an in-flight request at the deadline", async () => {
    vi.useFakeTimers()
    let requestSignal: AbortSignal | undefined
    const query = {
      abortSignal(signal: AbortSignal) {
        requestSignal = signal
        return new Promise<{ error: string }>((resolve) => {
          signal.addEventListener("abort", () => resolve({ error: "aborted" }), { once: true })
        })
      },
    }
    const result = withQueryTimeout(query, 7000)
    await vi.advanceTimersByTimeAsync(6999)
    expect(requestSignal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(requestSignal?.aborted).toBe(true)
    await expect(result).resolves.toEqual({ error: "aborted" })
    expect(vi.getTimerCount()).toBe(0)
  })

  it("cleans up the deadline after a successful request", async () => {
    vi.useFakeTimers()
    let requestSignal: AbortSignal | undefined
    const result = await withQueryTimeout({ abortSignal(signal) {
      requestSignal = signal
      return Promise.resolve({ data: ["listing"] })
    } })
    expect(result).toEqual({ data: ["listing"] })
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(7000)
    expect(requestSignal?.aborted).toBe(false)
  })

  it("preserves failures and cleans up the deadline", async () => {
    vi.useFakeTimers()
    await expect(withQueryTimeout({ abortSignal() {
      return Promise.reject(new Error("upstream failure"))
    } })).rejects.toThrow("upstream failure")
    expect(vi.getTimerCount()).toBe(0)
  })
})
