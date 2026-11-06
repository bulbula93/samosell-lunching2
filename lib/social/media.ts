/**
 * Instagram media preparation.
 * Instagram Content Publishing accepts only JPEG, and only aspect ratios between 4:5 and 1.91:1.
 * Listing photos are mostly WebP and often 3:4 portrait, so each one is converted ONCE into a
 * 1080×1350 (4:5) JPEG — the whole photo is kept (letterboxed on the brand background, never cropped)
 * — and stored in the public `social-media` bucket under a deterministic, content-addressed name.
 *
 * Cost: runs only when a draft is created or an admin presses "Instagram-ზეც" — never per page view.
 * Safety: sources are restricted to SamoSell's own public storage / site (no SSRF), redirects refused,
 * size and pixel limits enforced, and the output is re-encoded (metadata/EXIF dropped).
 */
import { BRAND_IMAGE_URL } from "./agents/creative"

export type MediaPreparer = (urls: string[]) => Promise<string[]>

export const SOCIAL_MEDIA_BUCKET = "social-media"
export const IG_WIDTH = 1080
export const IG_HEIGHT = 1350
const BACKGROUND = "#F6F1E7"
const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 8_000

export class MediaPrepareError extends Error {
  constructor(public readonly code: string) { super(code) }
}

/** Already Instagram-ready: our own brand JPEG, or something this module produced. */
export function isPreparedMedia(url: string, supabaseUrl: string) {
  if (url === BRAND_IMAGE_URL) return true
  try {
    const u = new URL(url)
    return u.origin === new URL(supabaseUrl).origin && u.pathname.startsWith(`/storage/v1/object/public/${SOCIAL_MEDIA_BUCKET}/`) && /\.jpe?g$/i.test(u.pathname)
  } catch { return false }
}

/** Only SamoSell-owned public sources may be fetched. */
export function sourceAllowed(url: string, supabaseUrl: string) {
  try {
    const u = new URL(url)
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false
    if (u.hostname === "samosell.ge" || u.hostname === "www.samosell.ge") return true
    return u.origin === new URL(supabaseUrl).origin && u.pathname.startsWith("/storage/v1/object/public/")
  } catch { return false }
}

export function preparedObjectPath(sourceUrl: string, digest: (input: string) => string) {
  return `v1/${digest(sourceUrl)}.jpg`
}

type Deps = {
  supabaseUrl: string
  fetcher: typeof fetch
  convert: (input: Uint8Array) => Promise<Uint8Array>
  upload: (path: string, body: Uint8Array) => Promise<void>
  digest: (input: string) => string
}

async function download(url: string, fetcher: typeof fetch) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetcher(url, { redirect: "error", signal: controller.signal, cache: "no-store" })
    if (!res.ok) throw new MediaPrepareError("media_source_unavailable")
    if (!/^image\//i.test(res.headers.get("content-type") ?? "")) throw new MediaPrepareError("media_not_image")
    const declared = Number(res.headers.get("content-length") ?? 0)
    if (declared > MAX_SOURCE_BYTES) throw new MediaPrepareError("media_too_large")
    const body = new Uint8Array(await res.arrayBuffer())
    if (body.byteLength === 0 || body.byteLength > MAX_SOURCE_BYTES) throw new MediaPrepareError("media_too_large")
    return body
  } catch (e) {
    if (e instanceof MediaPrepareError) throw e
    throw new MediaPrepareError("media_source_unavailable")
  } finally { clearTimeout(timer) }
}

/** Testable core: all I/O is injected. Preserves order; idempotent (same source → same object). */
export function createMediaPreparer(deps: Deps): MediaPreparer {
  return async (urls) => {
    const out: string[] = []
    for (const url of urls) {
      if (isPreparedMedia(url, deps.supabaseUrl)) { out.push(url); continue }
      if (!sourceAllowed(url, deps.supabaseUrl)) throw new MediaPrepareError("media_source_not_allowed")
      const path = preparedObjectPath(url, deps.digest)
      const jpeg = await deps.convert(await download(url, deps.fetcher))
      await deps.upload(path, jpeg)
      out.push(`${new URL(deps.supabaseUrl).origin}/storage/v1/object/public/${SOCIAL_MEDIA_BUCKET}/${path}`)
    }
    return out
  }
}

/** sharp conversion: auto-orient, fit inside 4:5 without cropping, flatten transparency, strip metadata. */
export async function convertToInstagramJpeg(input: Uint8Array): Promise<Uint8Array> {
  const { default: sharp } = await import("sharp")
  try {
    const buf = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate()
      .resize(IG_WIDTH, IG_HEIGHT, { fit: "contain", background: BACKGROUND })
      .flatten({ background: BACKGROUND })
      .jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer()
    return new Uint8Array(buf)
  } catch {
    throw new MediaPrepareError("media_convert_failed")
  }
}
