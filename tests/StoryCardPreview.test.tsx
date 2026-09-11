import { act, fireEvent, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import StoryCardPreview from "@/components/stories/StoryCardPreview"

afterEach(() => vi.useRealTimers())

it("loads an image through the protected media route and removes it at expiry", () => {
  vi.useFakeTimers()
  const { container } = render(<StoryCardPreview preview={{ storyId: "story-id", mediaType: "image", expiresAt: new Date(Date.now() + 1_000).toISOString() }} />)
  expect(container.querySelector("img")).toHaveAttribute("src", "/api/stories/media/story-id")
  act(() => vi.advanceTimersByTime(1_000))
  expect(container.querySelector("img")).toBeNull()
})

it("shows a video frame without autoplay and removes inaccessible media", () => {
  const { container } = render(<StoryCardPreview preview={{ storyId: "video-id", mediaType: "video", expiresAt: new Date(Date.now() + 60_000).toISOString() }} />)
  const video = container.querySelector("video")!
  expect(video).toHaveAttribute("src", "/api/stories/media/video-id#t=0.1")
  expect(video).not.toHaveAttribute("autoplay")
  expect(video.muted).toBe(true)
  fireEvent.error(video)
  expect(container.querySelector("video")).toBeNull()
})
