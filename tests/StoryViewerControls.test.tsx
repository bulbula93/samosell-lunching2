import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import StoryViewer from "@/components/stories/StoryViewer"

const mocks = vi.hoisted(() => ({ remove: vi.fn(), like: vi.fn(), reply: vi.fn() }))
vi.mock("@/app/stories/actions", () => ({ deleteStoryAction: mocks.remove, setStoryLikedAction: mocks.like, recordStoryViewAction: vi.fn(), recordStoryListingClickAction: vi.fn(), blockStoryOwnerAction: vi.fn(), replyToStoryAction: mocks.reply, reportStoryAction: vi.fn(), setStoryMuteAction: vi.fn() }))
const owner = { id: "owner", username: "nino", fullName: null, avatarUrl: null, storyCount: 2, unseenCount: 2, latestStoryAt: new Date().toISOString() }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ stories: ["first", "second"].map((id) => ({ id, ownerId: owner.id, mediaType: "image", mediaUrl: `/media/${id}`, caption: id, createdAt: new Date().toISOString(), viewed: false })) }) }))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it("clears the prior owner's media when the next owner fails to load", async () => {
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ stories: [{ id:"first",ownerId:owner.id,mediaType:"image",mediaUrl:"/media/first",caption:"first",createdAt:new Date().toISOString() }] }) } as Response)
    .mockRejectedValueOnce(new Error("offline"))
  render(<StoryViewer owners={[owner,{...owner,id:"next",username:"next"}]} initialOwnerIndex={0} currentUserId="other" onClose={vi.fn()} />)
  await screen.findByText("first")
  fireEvent.click(screen.getByRole("button", { name:"შემდეგი Story" }))
  await waitFor(() => expect(screen.queryByText("first")).not.toBeInTheDocument())
  expect(document.querySelector('img[src="/media/first"]')).toBeNull()
})

it("toggles one heart without sending a chat reply or exposing the author's count", async () => {
  mocks.like.mockImplementation(async (_id: string, liked: boolean) => ({ ok: true, liked }))
  render(<StoryViewer owners={[owner]} initialOwnerIndex={0} currentUserId="other" onClose={vi.fn()} />)
  await screen.findByText("first")
  fireEvent.click(screen.getByRole("button", { name: "Story-ის მოწონება" }))
  expect(await screen.findByRole("button", { name: "Story-ის მოწონების გაუქმება" })).toHaveAttribute("aria-pressed", "true")
  expect(mocks.like).toHaveBeenLastCalledWith("first", true)
  fireEvent.click(screen.getByRole("button", { name: "Story-ის მოწონების გაუქმება" }))
  expect(await screen.findByRole("button", { name: "Story-ის მოწონება" })).toHaveAttribute("aria-pressed", "false")
  expect(mocks.like).toHaveBeenLastCalledWith("first", false)
  expect(mocks.reply).not.toHaveBeenCalled()
  expect(screen.queryByLabelText("Story-ის მოწონებების რაოდენობა")).toBeNull()
})

it("navigates with visible arrow buttons and hides deletion from other viewers", async () => {
  render(<StoryViewer owners={[owner]} initialOwnerIndex={0} currentUserId="other" onClose={vi.fn()} />)
  await screen.findByText("first")
  expect(screen.queryByRole("button", { name: "Story-ის წაშლა" })).toBeNull()
  expect(screen.getByRole("button", { name: "წინა Story" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "შემდეგი Story" }))
  expect(await screen.findByText("second")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "წინა Story" }))
  expect(await screen.findByText("first")).toBeInTheDocument()
})

it("requires confirmation and closes only after successful deletion of the selected Story", async () => {
  const onClose = vi.fn()
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  mocks.remove.mockResolvedValue({ ok: true })
  render(<StoryViewer owners={[owner]} initialOwnerIndex={0} currentUserId="owner" onClose={onClose} />)
  await screen.findByText("first")
  fireEvent.click(screen.getByRole("button", { name: "Story-ის წაშლა" }))
  expect(mocks.remove).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole("button", { name: "Story-ის წაშლა" }))
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(mocks.remove).toHaveBeenCalledWith("first")
})

it("keeps the Story open and shows a safe error when deletion fails", async () => {
  const onClose = vi.fn()
  vi.spyOn(window, "confirm").mockReturnValue(true)
  mocks.remove.mockRejectedValue(new Error("private diagnostic"))
  render(<StoryViewer owners={[owner]} initialOwnerIndex={0} currentUserId="owner" onClose={onClose} />)
  await screen.findByText("first")
  fireEvent.click(screen.getByRole("button", { name: "Story-ის წაშლა" }))
  expect(await screen.findByRole("status")).toHaveTextContent("Story ვერ წაიშალა")
  expect(onClose).not.toHaveBeenCalled()
})
