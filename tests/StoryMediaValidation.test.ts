// @vitest-environment node
import { describe, it, expect } from "vitest"
import { videoFixture } from "./fixtures/story-video"
import { validateStoryMedia } from "@/lib/story-media-validation"

describe("authoritative Story media duration", () => {
  for (const format of ["webm", "mp4"] as const) {
    it(`accepts 15 seconds of ${format} packet timestamps`, async () => {
      const blob = await videoFixture(15, format)
      expect(await validateStoryMedia(blob, blob.type, blob.size, "video")).toEqual({ durationMs: 15000 })
    })
    it(`rejects ${format} over 15 seconds regardless of claimed duration`, async () => {
      const blob = await videoFixture(16, format)
      await expect(validateStoryMedia(blob, blob.type, blob.size, "video")).rejects.toThrow("story_video_too_long")
    })
  }
  it("fails closed for a truncated file with correct magic", async () => {
    const blob = new Blob([new Uint8Array([0x1a,0x45,0xdf,0xa3])])
    await expect(validateStoryMedia(blob, "video/webm", blob.size, "video")).rejects.toThrow()
  })
  it("keeps exact size and magic-byte checks", async () => {
    const blob = new Blob([new Uint8Array([0xff,0xd8,0xff])])
    await expect(validateStoryMedia(blob, "image/jpeg", 5, "image")).rejects.toThrow("invalid_story_media_size")
    await expect(validateStoryMedia(blob, "image/png", 3, "image")).rejects.toThrow("invalid_story_media_type")
  })
})
