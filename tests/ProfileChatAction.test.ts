// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest"
import { openProfileChatAction } from "@/app/seller/actions"
const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), redirect: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.user }, rpc: mocks.rpc }) }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
const recipient = "11111111-1111-4111-8111-111111111111"
beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ data: { user: { id: "caller" } }, error: null }) })
function form(id = recipient) { const data = new FormData(); data.set("recipientId", id); return data }
it("rejects invalid targets and anonymous sessions without calling the RPC", async () => {
  await openProfileChatAction({ message: "" }, form("invalid"))
  mocks.user.mockResolvedValue({ data: { user: null }, error: null })
  await openProfileChatAction({ message: "" }, form())
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it("opens only the UUID returned by the authenticated chat RPC", async () => {
  mocks.rpc.mockResolvedValue({ data: recipient, error: null })
  await openProfileChatAction({ message: "" }, form())
  expect(mocks.rpc).toHaveBeenCalledWith("open_profile_direct_chat", { p_recipient_id: recipient })
  expect(mocks.redirect).toHaveBeenCalledWith(`/dashboard/chats/${recipient}`)
})
it("does not navigate when the server rejects a blocked conversation", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "conversation_blocked" } })
  const result = await openProfileChatAction({ message: "" }, form())
  expect(result?.message).toBeTruthy()
  expect(mocks.redirect).not.toHaveBeenCalled()
})
