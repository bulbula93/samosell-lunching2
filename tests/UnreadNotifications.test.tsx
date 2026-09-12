import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { useUnreadNotifications } from "@/lib/use-unread-notifications"

const mocks = vi.hoisted(() => ({ from: vi.fn(), on: vi.fn(), remove: vi.fn(), eq: vi.fn(), result: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: mocks.from, channel: () => ({ on: mocks.on }), removeChannel: mocks.remove }) }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.from.mockReturnValue({ select: () => ({ eq: mocks.eq }) })
  mocks.eq.mockReturnValue({ is: () => ({ not: () => Promise.resolve({count: 0, error: null}), in: mocks.result }) })
  mocks.result.mockResolvedValue({ count: 0, error: null })
  mocks.on.mockReturnValue({ subscribe: () => ({ channel: "test" }) })
})

it("refreshes the badge on incoming and read events, scoped to the recipient", async () => {
  const { result, unmount } = renderHook(() => useUnreadNotifications("recipient", 0))
  await waitFor(() => expect(mocks.result).toHaveBeenCalledOnce())
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "recipient")
  expect(mocks.on.mock.calls[0][1]).toMatchObject({ table: "notifications", filter: "user_id=eq.recipient" })
  mocks.result.mockResolvedValue({ count: 1, error: null })
  await act(async () => { mocks.on.mock.calls[0][2]() })
  await waitFor(() => expect(result.current).toEqual({ notifications: 0, chats: 1 }))
  mocks.result.mockResolvedValue({ count: 0, error: null })
  await act(async () => { mocks.on.mock.calls[0][2]() })
  await waitFor(() => expect(result.current).toEqual({ notifications: 0, chats: 0 }))
  unmount()
  expect(mocks.remove).toHaveBeenCalledOnce()
})

it("does not subscribe or query for guests", () => {
  renderHook(() => useUnreadNotifications(null, 0))
  expect(mocks.from).not.toHaveBeenCalled()
  expect(mocks.on).not.toHaveBeenCalled()
})
