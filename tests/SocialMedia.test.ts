// @vitest-environment node
/** Instagram media preparation: SSRF guard, idempotent paths, real sharp conversion, orchestrator wiring. */
import sharp from "sharp"
import { describe, expect, it, vi } from "vitest"
import { checkQuality } from "@/lib/social/agents/quality"
import { BRAND_IMAGE_URL } from "@/lib/social/agents/creative"
import {
  convertToInstagramJpeg, createMediaPreparer, IG_HEIGHT, IG_WIDTH, isPreparedMedia, MediaPrepareError, sourceAllowed,
} from "@/lib/social/media"
import { enableInstagramForPost, PolicyDeniedError, runPlanningCycle } from "@/lib/social/orchestrator"
import { resolveSocialRuntime } from "@/lib/social/runtime"
import { MemorySocialStore } from "@/lib/social/store"
import type { CandidateListing } from "@/lib/social/types"

const SUPA = "https://lxsvjzbiuewgwpajqrwr.supabase.co"
const WEBP = `${SUPA}/storage/v1/object/public/listing-images/u/l/photo.webp`
const JPG = `${SUPA}/storage/v1/object/public/listing-images/u/l/photo2.jpg`
const ADMIN = "11111111-1111-4111-8111-111111111111"
const preview = resolveSocialRuntime({ VERCEL_ENV: "preview" })

function imageResponse(type = "image/webp", size = 100) {
  return new Response(new Uint8Array(size), { status: 200, headers: { "content-type": type, "content-length": String(size) } })
}
function fakeDeps(over: Partial<Parameters<typeof createMediaPreparer>[0]> = {}) {
  const uploads: string[] = []
  const deps = {
    supabaseUrl: SUPA,
    fetcher: vi.fn(async () => imageResponse()) as unknown as typeof fetch,
    convert: vi.fn(async () => new Uint8Array([0xff, 0xd8, 0xff])),
    upload: vi.fn(async (path: string) => { uploads.push(path) }),
    digest: (s: string) => `h${s.length}`,
    ...over,
  }
  return { deps, uploads }
}

describe("source allowlist (SSRF guard)", () => {
  it("allows only SamoSell public storage and the site itself", () => {
    expect(sourceAllowed(WEBP, SUPA)).toBe(true)
    expect(sourceAllowed("https://samosell.ge/brand/x.webp", SUPA)).toBe(true)
    for (const bad of [
      "http://lxsvjzbiuewgwpajqrwr.supabase.co/storage/v1/object/public/listing-images/a.webp",
      "https://evil.supabase.co/storage/v1/object/public/listing-images/a.webp",
      `${SUPA}/storage/v1/object/sign/chat-images/a.webp`,
      `${SUPA}/rest/v1/profiles`,
      "https://user:pw@samosell.ge/a.webp",
      "https://samosell.ge:8443/a.webp",
      "https://169.254.169.254/latest",
      "not a url",
    ]) expect(sourceAllowed(bad, SUPA), bad).toBe(false)
  })
  it("recognises already prepared media", () => {
    expect(isPreparedMedia(BRAND_IMAGE_URL, SUPA)).toBe(true)
    expect(isPreparedMedia(`${SUPA}/storage/v1/object/public/social-media/v1/abc.jpg`, SUPA)).toBe(true)
    expect(isPreparedMedia(JPG, SUPA)).toBe(false) // a listing JPEG may still have a 3:4 ratio Instagram rejects
  })
})

describe("createMediaPreparer", () => {
  it("converts listing photos into deterministic social-media JPEGs, keeping order and brand images", async () => {
    const { deps, uploads } = fakeDeps()
    const out = await createMediaPreparer(deps)([WEBP, BRAND_IMAGE_URL, JPG])
    expect(out[1]).toBe(BRAND_IMAGE_URL)
    expect(out[0]).toBe(`${SUPA}/storage/v1/object/public/social-media/v1/h${WEBP.length}.jpg`)
    expect(out[2]).toMatch(/\/social-media\/v1\/h\d+\.jpg$/)
    expect(uploads).toHaveLength(2)
    expect(deps.fetcher).toHaveBeenCalledWith(WEBP, expect.objectContaining({ redirect: "error" }))
    // Output passes the Instagram JPEG QA rule.
    const qa = checkQuality({ caption: "ტესტი ქართულად", hashtags: ["samosell"], mediaUrls: out.slice(0, 1), linkUrl: null, platforms: ["instagram"], contentType: "single_image", scheduledFor: "2030-01-01T10:00:00Z" })
    expect(qa.issues.map(i => i.code)).not.toContain("instagram_requires_jpeg")
  })
  it("refuses foreign hosts without fetching", async () => {
    const { deps } = fakeDeps()
    await expect(createMediaPreparer(deps)(["https://example.com/a.webp"])).rejects.toMatchObject({ code: "media_source_not_allowed" })
    expect(deps.fetcher).not.toHaveBeenCalled()
  })
  it("rejects non-images, oversized files and failed downloads", async () => {
    const cases: Array<[Response | Error, string]> = [
      [imageResponse("text/html"), "media_not_image"],
      [imageResponse("image/webp", 11 * 1024 * 1024), "media_too_large"],
      [new Response("x", { status: 404 }), "media_source_unavailable"],
      [new TypeError("redirect"), "media_source_unavailable"],
    ]
    for (const [res, code] of cases) {
      const { deps } = fakeDeps({ fetcher: vi.fn(async () => { if (res instanceof Error) throw res; return res }) as unknown as typeof fetch })
      await expect(createMediaPreparer(deps)([WEBP])).rejects.toMatchObject({ code })
      expect(deps.upload).not.toHaveBeenCalled()
    }
  })
})

describe("convertToInstagramJpeg (real sharp)", () => {
  it("turns a 3:4 transparent WebP into a 1080×1350 JPEG without cropping", async () => {
    const webp = await sharp({ create: { width: 600, height: 800, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 0.5 } } }).webp().toBuffer()
    const out = await convertToInstagramJpeg(new Uint8Array(webp))
    const meta = await sharp(Buffer.from(out)).metadata()
    expect(meta).toMatchObject({ format: "jpeg", width: IG_WIDTH, height: IG_HEIGHT })
    expect(meta.exif).toBeUndefined()
  })
  it("fails closed on garbage input", async () => {
    await expect(convertToInstagramJpeg(new Uint8Array([1, 2, 3, 4]))).rejects.toBeInstanceOf(MediaPrepareError)
  })
})

describe("orchestrator wiring", () => {
  const listings: CandidateListing[] = Array.from({ length: 6 }, (_, i) => ({
    id: `l${i}`, slug: `item-${i}`, title: `ნივთი ${i}`, brand: "Zara", priceGel: 20 + i, city: "თბილისი", category: "კაბები", imageUrl: WEBP.replace("photo", `p${i}`), isGift: false,
  }))
  function setup(control = {}) {
    const now = new Date("2026-11-06T10:00:00Z")
    const store = new MemorySocialStore(() => now, { killSwitch: false, ...control })
    return { store, now: () => now }
  }

  it("planning keeps Instagram for WebP listing posts once media is prepared", async () => {
    const { store, now } = setup()
    const prepareMedia = vi.fn(async (urls: string[]) => urls.map((u, i) => (u === BRAND_IMAGE_URL ? u : `${SUPA}/storage/v1/object/public/social-media/v1/x${i}.jpg`)))
    const r = await runPlanningCycle({ store, runtime: preview, now, prepareMedia }, { weekStart: "2026-11-09", listings })
    const listingPosts = r.posts.filter(p => p.listingId !== null || p.pillar === "category_roundup")
    expect(listingPosts.length).toBeGreaterThan(0)
    for (const p of listingPosts) {
      expect(p.platforms).toContain("instagram")
      expect(p.qualityPassed).toBe(true)
    }
    expect(r.passedQa).toBe(r.created)
  })

  it("planning falls back to Facebook-only and audits when preparation fails", async () => {
    const { store, now } = setup()
    const prepareMedia = vi.fn(async () => { throw new MediaPrepareError("media_convert_failed") })
    const r = await runPlanningCycle({ store, runtime: preview, now, prepareMedia }, { weekStart: "2026-11-09", listings })
    const featured = r.posts.find(p => p.pillar === "featured_listing")!
    expect(featured.platforms).toEqual(["facebook"])
    expect(featured.qualityPassed).toBe(true)
    expect(store.audit.some(a => a.reason === "media_convert_failed" && a.decision === "failure")).toBe(true)
  })

  it("admin 'Instagram-ზეც' creates a new version, re-runs QA and needs a fresh approval", async () => {
    const { store, now } = setup()
    const plan = await runPlanningCycle({ store, runtime: preview, now }, { weekStart: "2026-11-09", listings })
    const fbOnly = plan.posts.find(p => p.pillar === "featured_listing")!
    expect(fbOnly.platforms).toEqual(["facebook"])
    const prepareMedia = vi.fn(async () => [`${SUPA}/storage/v1/object/public/social-media/v1/a.jpg`])
    const updated = await enableInstagramForPost({ store, runtime: preview, now, prepareMedia }, fbOnly.id, fbOnly.version, ADMIN)
    expect(updated.version).toBe(fbOnly.version + 1)
    expect(updated.platforms).toEqual(["instagram", "facebook"])
    expect(updated.status).toBe("ready_for_review")
    const pending = (await store.listApprovals(fbOnly.id)).filter(a => a.status === "pending")
    expect(pending.map(a => a.postVersion)).toEqual([updated.version])
    // Old version can no longer be acted on.
    await expect(enableInstagramForPost({ store, runtime: preview, now, prepareMedia }, fbOnly.id, fbOnly.version, ADMIN)).rejects.toMatchObject({ code: "stale_version" })
  })

  it("is denied when Instagram is disabled or the kill switch is on", async () => {
    const { store, now } = setup()
    const plan = await runPlanningCycle({ store, runtime: preview, now }, { weekStart: "2026-11-09", listings })
    const post = plan.posts.find(p => p.pillar === "featured_listing")!
    const prepareMedia = vi.fn(async (u: string[]) => u)
    await store.updateControl({ instagramEnabled: false })
    await expect(enableInstagramForPost({ store, runtime: preview, now, prepareMedia }, post.id, post.version, ADMIN)).rejects.toThrow(PolicyDeniedError)
    await store.updateControl({ instagramEnabled: true, killSwitch: true })
    await expect(enableInstagramForPost({ store, runtime: preview, now, prepareMedia }, post.id, post.version, ADMIN)).rejects.toThrow(PolicyDeniedError)
    expect(prepareMedia).not.toHaveBeenCalled()
  })
})
