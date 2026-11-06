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

/* ───────────────────────────── Stories (9:16) ───────────────────────────── */

export const STORY_WIDTH = 1080
export const STORY_HEIGHT = 1920
const STORY_GREEN = "#1F3D2B"
const STORY_CREAM = "#F6F1E7"

export type StoryContent = { title: string; priceLabel: string; city: string | null }
export type StoryAssets = { fontBold: string; fontMedium: string; logo: Uint8Array }

/** Pango markup must not interpret listing text (titles are user input). */
export function escapeMarkup(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

export function storyTitle(title: string, max = 44) {
  const t = title.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd().replace(/[,.;:–-]+$/, "")}…`
}

/**
 * 1080×1920 Story: logo, the listing photo (never cropped), title, price, city and a footer
 * pointing to the link-in-bio page. Text uses the bundled FiraGO font (Georgian), so rendering
 * does not depend on fonts installed on the server. Key content stays out of Instagram's
 * top/bottom UI zones (~250px each).
 */
export async function renderStoryJpeg(photo: Uint8Array, content: StoryContent, assets: StoryAssets): Promise<Uint8Array> {
  const { default: sharp } = await import("sharp")
  const text = async (markup: string, font: string, fontfile: string, color: string, width = 960) => {
    const r = await sharp({ text: { text: `<span foreground="${color}">${markup}</span>`, font, fontfile, width, rgba: true, wrap: "word", align: "centre" } })
      .png().toBuffer({ resolveWithObject: true })
    return { input: r.data, width: r.info.width, height: r.info.height }
  }
  try {
    const photoBuf = await sharp(photo, { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate().resize(940, 860, { fit: "contain", background: "#FFFFFF" }).flatten({ background: "#FFFFFF" }).png().toBuffer()
    const card = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="980" height="900"><rect width="980" height="900" rx="36" fill="#FFFFFF"/></svg>`)
    const cardMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="940" height="860"><rect width="940" height="860" rx="24" fill="#000"/></svg>`)
    const roundedPhoto = await sharp(photoBuf).composite([{ input: cardMask, blend: "dest-in" }]).png().toBuffer()
    const logo = await sharp(assets.logo).resize({ width: 420 }).png().toBuffer({ resolveWithObject: true })

    const title = await text(escapeMarkup(storyTitle(content.title)), "FiraGO ExtraBold 54", assets.fontBold, STORY_GREEN)
    const price = await text(escapeMarkup(content.priceLabel), "FiraGO ExtraBold 88", assets.fontBold, STORY_GREEN)
    const city = content.city ? await text(escapeMarkup(content.city), "FiraGO Medium 40", assets.fontMedium, "#5B6B61") : null
    const cta = await text("ნახე SamoSell-ზე · samosell.ge/links", "FiraGO ExtraBold 44", assets.fontBold, "#FFFFFF")
    const sub = await text("განცხადება უფასოა · საკომისიო 0%", "FiraGO Medium 36", assets.fontMedium, STORY_CREAM)

    const centre = (w: number) => Math.round((STORY_WIDTH - w) / 2)
    const layers: Array<{ input: Buffer; top: number; left: number }> = [
      { input: logo.data, top: 150, left: centre(logo.info.width) },
      { input: card, top: 300, left: 50 },
      { input: roundedPhoto, top: 320, left: 70 },
    ]
    let y = 1236
    layers.push({ input: title.input, top: y, left: centre(title.width) }); y += title.height + 10
    layers.push({ input: price.input, top: y, left: centre(price.width) }); y += price.height + 4
    if (city && y + city.height < 1570) layers.push({ input: city.input, top: y, left: centre(city.width) })
    const band = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${STORY_WIDTH}" height="300"><rect width="${STORY_WIDTH}" height="300" fill="${STORY_GREEN}"/></svg>`)
    layers.push({ input: band, top: 1590, left: 0 })
    layers.push({ input: cta.input, top: 1624, left: centre(cta.width) })
    layers.push({ input: sub.input, top: 1624 + cta.height + 14, left: centre(sub.width) })

    const out = await sharp({ create: { width: STORY_WIDTH, height: STORY_HEIGHT, channels: 3, background: STORY_CREAM } })
      .composite(layers).jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:2:0" }).toBuffer()
    return new Uint8Array(out)
  } catch {
    throw new MediaPrepareError("story_render_failed")
  }
}

export type StoryPreparer = (listing: { id: string; imageUrl: string | null; title: string; priceLabel: string; city: string | null }) => Promise<string>

type StoryDeps = Omit<Deps, "convert"> & { assets: () => Promise<StoryAssets>; render?: typeof renderStoryJpeg }

/** Download the listing photo (same SSRF guard), render the Story, upload under a content-addressed name. */
export function createStoryPreparer(deps: StoryDeps): StoryPreparer {
  return async (listing) => {
    if (!listing.imageUrl || !sourceAllowed(listing.imageUrl, deps.supabaseUrl)) throw new MediaPrepareError("media_source_not_allowed")
    const photo = await download(listing.imageUrl, deps.fetcher)
    const jpeg = await (deps.render ?? renderStoryJpeg)(photo, { title: listing.title, priceLabel: listing.priceLabel, city: listing.city }, await deps.assets())
    const path = `stories/v1/${deps.digest(JSON.stringify([listing.id, listing.imageUrl, listing.title, listing.priceLabel, listing.city]))}.jpg`
    await deps.upload(path, jpeg)
    return `${new URL(deps.supabaseUrl).origin}/storage/v1/object/public/${SOCIAL_MEDIA_BUCKET}/${path}`
  }
}
