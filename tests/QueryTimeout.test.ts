import { afterEach, describe, expect, it, vi } from "vitest"
import { QueryTimeoutError, withQueryTimeout, withQueryTimeoutResult } from "@/lib/supabase/query-timeout"

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
    const rejected = expect(result).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6999)
    expect(requestSignal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(requestSignal?.aborted).toBe(true)
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })

  it("stops waiting when the transport ignores abort and consumes a late rejection", async () => {
    vi.useFakeTimers()
    let rejectTransport!: (error: Error) => void
    let signal: AbortSignal | undefined
    const result = withQueryTimeout((requestSignal) => {
      signal = requestSignal
      return new Promise<never>((_, reject) => { rejectTransport = reject })
    }, 6000)
    const rejected = expect(result).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await rejected
    expect(signal?.aborted).toBe(true)
    rejectTransport(new Error("late transport failure"))
    await Promise.resolve()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("rejects a late response even if the deadline timer did not get to run", async () => {
    vi.useFakeTimers()
    const result = withQueryTimeout(async () => {
      vi.setSystemTime(Date.now() + 20_000)
      return { data: ["late"] }
    }, 15000)
    await expect(result).rejects.toBeInstanceOf(QueryTimeoutError)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("does not start upstream work when execution resumes after the deadline", async () => {
    vi.useFakeTimers()
    const read = vi.fn().mockResolvedValue({ data: ["late"] })
    const result = withQueryTimeout(read, 15000)
    // Advance wall time without running timer callbacks or the request microtask.
    vi.setSystemTime(Date.now() + 327_000)
    await expect(result).rejects.toBeInstanceOf(QueryTimeoutError)
    expect(read).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("returns the catalog's error shape for a timeout without hiding other failures", async () => {
    vi.useFakeTimers()
    const result = withQueryTimeoutResult(() => new Promise<never>(() => {}), 6000)
    await vi.advanceTimersByTimeAsync(6000)
    await expect(result).resolves.toMatchObject({ data: null, count: null, error: { code: "query_timeout" }, status: 504 })
    await expect(withQueryTimeoutResult(() => Promise.reject(new Error("bug")))).rejects.toThrow("bug")
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
