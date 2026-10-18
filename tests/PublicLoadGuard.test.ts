import { afterEach, describe, expect, it, vi } from "vitest"
import { guardPublicLoad } from "@/lib/public-load-guard"

afterEach(() => vi.useRealTimers())

describe("public loader request coalescing", () => {
  it("performs one upstream read for concurrent misses without extending success TTLs", async () => {
    let resolve!: (value: string[]) => void
    const load = vi.fn(() => new Promise<string[]>((done) => { resolve = done }))
    const guarded = guardPublicLoad(load)
    const reads = Array.from({ length: 20 }, () => guarded())
    await Promise.resolve()
    expect(load).toHaveBeenCalledOnce()
    resolve(["public listing"])
    expect(await Promise.all(reads)).toEqual(Array(20).fill(["public listing"]))
    const next = guarded()
    await Promise.resolve()
    expect(load).toHaveBeenCalledTimes(2)
    resolve(["updated listing"])
    await expect(next).resolves.toEqual(["updated listing"])
  })

  it("backs off failed reads, does not cache empty data and recovers after the cooldown", async () => {
    vi.useFakeTimers()
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(["recovered"])
    const guarded = guardPublicLoad(load)
    await expect(guarded()).rejects.toThrow("offline")
    const suppressed = Array.from({ length: 20 }, () => guarded())
    expect((await Promise.allSettled(suppressed)).every((read) => read.status === "rejected")).toBe(true)
    expect(load).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(guarded()).resolves.toEqual(["recovered"])
    expect(load).toHaveBeenCalledTimes(2)
  })
})
