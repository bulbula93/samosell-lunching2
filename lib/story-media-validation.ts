import "server-only"
import { BufferSource, EncodedPacketSink, Input, MP4, WEBM } from "mediabunny"
import { detectStoryMimeType, STORY_IMAGE_MAX_BYTES, STORY_VIDEO_MAX_BYTES, STORY_VIDEO_MAX_DURATION_MS, storyMediaTypeForMime } from "@/lib/stories"

/** Scan packet timestamps, never client duration or just a container duration tag. */
export async function validateStoryMedia(blob: Blob, mime: string, expectedSize: number, mediaType: string) {
  const maxBytes = mediaType === "video" ? STORY_VIDEO_MAX_BYTES : STORY_IMAGE_MAX_BYTES
  if (blob.size < 1 || blob.size > maxBytes || blob.size !== expectedSize) throw new Error("invalid_story_media_size")
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (detectStoryMimeType(bytes) !== mime || storyMediaTypeForMime(mime) !== mediaType) throw new Error("invalid_story_media_type")
  if (mediaType === "image") return { durationMs: null }
  const input = new Input({ source: new BufferSource(bytes), formats: [MP4, WEBM] })
  try {
    const tracks = await input.getTracks()
    if (!tracks.some(track => track.isVideoTrack()) || tracks.length > 8) throw new Error("invalid_story_video")
    let end = 0
    let count = 0
    for (const track of tracks) {
      if (await track.isLive()) throw new Error("invalid_story_video")
      let trackPackets = 0
      for await (const packet of new EncodedPacketSink(track).packets(undefined, undefined, { metadataOnly: true })) {
        if (++count > 20_000 || !Number.isFinite(packet.timestamp) || !Number.isFinite(packet.duration) || packet.timestamp < 0 || packet.duration <= 0) throw new Error("invalid_story_video")
        trackPackets++
        end = Math.max(end, packet.timestamp + packet.duration)
        if (end * 1000 > STORY_VIDEO_MAX_DURATION_MS) throw new Error("story_video_too_long")
      }
      if (!trackPackets) throw new Error("invalid_story_video")
    }
    if (!Number.isFinite(end) || end <= 0) throw new Error("invalid_story_video")
    return { durationMs: Math.ceil(end * 1000) }
  } finally {
    input.dispose()
  }
}
