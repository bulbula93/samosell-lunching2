import { act, renderHook, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useUnreadNotifications, NOTIFICATION_FALLBACK_MS, NOTIFICATION_DISCONNECTED_MS } from "@/lib/use-unread-notifications"

const mocks = vi.hoisted(() => ({ from: vi.fn(), channel: vi.fn(), on: vi.fn(), subscribe: vi.fn(), removeChannel: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks }))
let status: (status: string) => void
let event: () => void
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  const result = { count: 2, error: null }
  const query = { select: () => query, eq: () => query, is: () => query, not: () => Promise.resolve(result), in: () => Promise.resolve(result) }
  mocks.from.mockReturnValue(query)
  mocks.channel.mockReturnValue(mocks)
  mocks.on.mockImplementation((_type, _filter, handler) => { event = handler; return mocks })
  mocks.subscribe.mockImplementation((handler) => { status = handler; return mocks })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
async function tick(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

it("shares one channel/refresh loop for duplicate consumers and ignores changing server seeds for subscription lifetime", async () => {
  const first = renderHook(({ seed }) => useUnreadNotifications("u", seed), { initialProps: { seed: 0 } })
  const second = renderHook(() => useUnreadNotifications("u", 0))
  await tick()
  expect(mocks.channel).toHaveBeenCalledOnce()
  expect(mocks.from).toHaveBeenCalledTimes(2)
  first.rerender({ seed: 3 })
  expect(mocks.channel).toHaveBeenCalledOnce()
  first.unmount()
  expect(mocks.removeChannel).not.toHaveBeenCalled()
  second.unmount()
  expect(mocks.removeChannel).toHaveBeenCalledOnce()
  await tick(NOTIFICATION_FALLBACK_MS * 2)
  expect(mocks.from).toHaveBeenCalledTimes(2)
})
it("uses five-minute fallback while subscribed and one-minute fallback when disconnected", async () => {
  renderHook(() => useUnreadNotifications("u", 0))
  await tick()
  act(() => status("SUBSCRIBED"))
  await tick(30_000)
  expect(mocks.from).toHaveBeenCalledTimes(2)
  await tick(NOTIFICATION_FALLBACK_MS - 30_000)
  expect(mocks.from).toHaveBeenCalledTimes(4)
  act(() => status("CHANNEL_ERROR"))
  await tick(NOTIFICATION_DISCONNECTED_MS)
  expect(mocks.from).toHaveBeenCalledTimes(6)
})
it("cancels hidden timers/events and refreshes once on focus plus visibility resume", async () => {
  renderHook(() => useUnreadNotifications("u", 0))
  await tick()
  act(() => status("SUBSCRIBED"))
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
  act(() => document.dispatchEvent(new Event("visibilitychange")))
  act(() => { event(); window.dispatchEvent(new Event("focus")) })
  await tick(NOTIFICATION_FALLBACK_MS * 2)
  expect(mocks.from).toHaveBeenCalledTimes(2)
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  act(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")) })
  await tick()
  expect(mocks.from).toHaveBeenCalledTimes(4)
})
it("coalesces event bursts and removes queued events on unmount", async () => {
  const hook = renderHook(() => useUnreadNotifications("u", 0))
  await tick()
  act(() => { event(); event(); event() })
  await tick(100)
  expect(mocks.from).toHaveBeenCalledTimes(4)
  act(() => event())
  hook.unmount()
  await tick(NOTIFICATION_FALLBACK_MS)
  expect(mocks.from).toHaveBeenCalledTimes(4)
})
it("runs no timers or channel for guests, tears down on logout and isolates changed recipients", async () => {
  const hook = renderHook(({ id }) => useUnreadNotifications(id, 0), { initialProps: { id: null as string | null } })
  await tick(NOTIFICATION_FALLBACK_MS)
  expect(mocks.from).not.toHaveBeenCalled()
  hook.rerender({ id: "u" })
  await tick()
  hook.rerender({ id: "v" })
  await tick()
  expect(mocks.channel.mock.calls.map(([name]) => name)).toEqual(["notification-count:u", "notification-count:v"])
  expect(mocks.removeChannel).toHaveBeenCalledOnce()
  hook.rerender({ id: null })
  expect(hook.result.current).toEqual({ notifications: 0, chats: 0 })
  expect(mocks.removeChannel).toHaveBeenCalledTimes(2)
})
it("does not publish late responses after cleanup", async () => {
  let resolve!: (value: { count: number; error: null }) => void
  const pending = new Promise<{ count: number; error: null }>((r) => { resolve = r })
  const query = { select: () => query, eq: () => query, is: () => query, not: () => pending, in: () => pending }
  mocks.from.mockReturnValue(query)
  const hook = renderHook(() => useUnreadNotifications("u", 0))
  hook.unmount()
  await act(async () => resolve({ count: 9, error: null }))
  expect(vi.getTimerCount()).toBe(0)
})
