import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import FollowButton from "@/components/stories/FollowButton"
import StoriesRail from "@/components/stories/StoriesRail"
import ChatThreadClient from "@/components/chat/ChatThreadClient"
import StoryViewer from "@/components/stories/StoryViewer"

const mocks = vi.hoisted(() => ({ setFollowAction: vi.fn(), recordStoryViewAction: vi.fn(), createClient: vi.fn() }))
vi.mock("@/app/stories/actions", () => ({
  setFollowAction: mocks.setFollowAction,
  recordStoryViewAction: mocks.recordStoryViewAction,
  recordStoryListingClickAction: vi.fn(), replyToStoryAction: vi.fn(), reportStoryAction: vi.fn(), setStoryMuteAction: vi.fn(), deleteStoryAction: vi.fn(), blockStoryOwnerAction: vi.fn(),
  prepareStoryUploadAction: vi.fn(), publishStoryAction: vi.fn(), abortStoryUploadAction: vi.fn(),
}))
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }))
vi.mock("@/app/dashboard/chats/actions", () => ({ loadOlderMessagesAction: vi.fn(), markChatReadAction: vi.fn(), sendChatMessageAction: vi.fn() }))

const owner = { id: "177f3329-6c04-4c40-8f33-873ab3ee4f76", username: "nino", fullName: "ნინო", avatarUrl: null, storyCount: 2, unseenCount: 1, latestStoryAt: "2026-09-08T08:00:00Z" }

describe("Stories and Following UI", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.createClient.mockReturnValue({ channel: () => ({ on() { return this }, subscribe() { return this } }), removeChannel: vi.fn() }) })
  it("renders one owner once with unseen accent state and a stable composer entry", () => {
    render(<StoriesRail data={{ owners: [owner], currentUserId: owner.id, currentUsername: owner.username, composerListings: [], ownStats: { views: 2, replies: 1, listingClicks: 1 } }} />)
    expect(screen.getByRole("button", { name: "nino-ის Story" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Story-ის დამატება" })).toBeInTheDocument()
    expect(screen.getByText(/ნახვები 2/)).toBeInTheDocument()
  })
  it("toggles Follow only after a successful server result", async () => {
    mocks.setFollowAction.mockResolvedValue({ ok: true, followed: true })
    render(<FollowButton userId={owner.id} initialFollowing={false} />)
    fireEvent.click(screen.getByRole("button", { name: "გამოწერა" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "გამოწერილი ✓" })).toHaveAttribute("aria-pressed", "true"))
  })
  it("renders a safe unavailable context while preserving a Story reply body", () => {
    render(<ChatThreadClient chatId="277f3329-6c04-4c40-8f33-873ab3ee4f76" currentUserId={owner.id} otherPartyLabel="გიორგი" canSend={false} initialHasMore={false} initialMessages={[{ id: "377f3329-6c04-4c40-8f33-873ab3ee4f76", chat_id: "277f3329-6c04-4c40-8f33-873ab3ee4f76", sender_id: owner.id, body: "🔥", created_at: "2026-09-08T08:00:00Z", message_type: "story_reply", story_id: "477f3329-6c04-4c40-8f33-873ab3ee4f76", story_context: { available: false, caption: null, linkedListingSlug: null } }]} />)
    expect(screen.getByText("Story აღარ არის ხელმისაწვდომი")).toBeInTheDocument()
    expect(screen.getByText("🔥")).toBeInTheDocument()
  })
  it("loads the unseen Story sequence and supports keyboard next/close", async () => {
    const onClose = vi.fn()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ stories: [
      { id: "477f3329-6c04-4c40-8f33-873ab3ee4f76", ownerId: owner.id, mediaPath: "one.webp", mediaUrl: "https://cdn.test/one.webp", mediaType: "image", caption: "პირველი", createdAt: "2026-09-08T08:00:00Z", expiresAt: "2026-09-09T08:00:00Z", durationMs: null, linkedListing: null, viewed: false },
      { id: "577f3329-6c04-4c40-8f33-873ab3ee4f76", ownerId: owner.id, mediaPath: "two.webp", mediaUrl: "https://cdn.test/two.webp", mediaType: "image", caption: "მეორე", createdAt: "2026-09-08T08:01:00Z", expiresAt: "2026-09-09T08:01:00Z", durationMs: null, linkedListing: null, viewed: false },
    ] }) }))
    render(<StoryViewer owners={[owner]} initialOwnerIndex={0} currentUserId={null} onClose={onClose} />)
    expect(await screen.findByText("პირველი")).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "ArrowRight" })
    expect(await screen.findByText("მეორე")).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
