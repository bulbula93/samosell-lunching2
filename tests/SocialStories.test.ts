// @vitest-environment node
/** Story companions: rendering, SSRF guard, drafts/QA, orchestrator flow, Meta adapters (mocked). */
import { readFileSync } from "node:fs"
import sharp from "sharp"
import { describe, expect, it, vi } from "vitest"
import { createStoryDraft, STORY_DELAY_MINUTES, storyKey, storyPriceLabel } from "@/lib/social/agents/creative"
import { checkQuality } from "@/lib/social/agents/quality"
import { FacebookLiveAdapter, igTarget, InstagramLiveAdapter, MetaGraphClient, pageTarget, type MetaCredentials } from "@/lib/social/adapters/meta"
import { createStoryPreparer, escapeMarkup, MediaPrepareError, renderStoryJpeg, STORY_HEIGHT, STORY_WIDTH, storyTitle } from "@/lib/social/media"
import { addStoryForPost, approvePostAndStory, PolicyDeniedError, runPlanningCycle } from "@/lib/social/orchestrator"
import { resolveSocialRuntime } from "@/lib/social/runtime"
import { MemorySocialStore } from "@/lib/social/store"
import { runPublishTick } from "@/lib/social/worker"
import type { CandidateListing } from "@/lib/social/types"

const SUPA = "https://lxsvjzbiuewgwpajqrwr.supabase.co"
const PHOTO_URL = `${SUPA}/storage/v1/object/public/listing-images/u/l/photo.webp`
const ADMIN = "11111111-1111-4111-8111-111111111111"
const preview = resolveSocialRuntime({ VERCEL_ENV: "preview" })
const A = "lib/social/assets/"
const assets = { fontBold: `${A}FiraGO-ExtraBold.ttf`, fontMedium: `${A}FiraGO-Medium.ttf`, logo: new Uint8Array(readFileSync(`${A}logo-520.png`)) }
const listing = (i: number, over: Partial<CandidateListing> = {}): CandidateListing => ({
  id: `l${i}`, slug: `item-${i}`, title: `ნივთი ნომერი ${i}`, brand: "Zara", priceGel: 20 + i, city: "თბილისი", category: "კაბები", imageUrl: PHOTO_URL.replace("photo", `p${i}`), isGift: false, ...over,
})
const LISTINGS = [listing(1), listing(2), listing(3, { isGift: true, priceGel: 0 }), listing(4), listing(5), listing(6), listing(7)]

describe("story text helpers", () => {
  it("escapes Pango markup in user-provided titles", () => {
    expect(escapeMarkup(`<b>"x" & 'y'</b>`)).toBe("&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;")
  })
  it("caps titles at two lines, preferring a word boundary", () => {
    const t = storyTitle("Isabel Marant სპორტული ფეხსაცმელი, ძალიან კარგ მდგომარეობაში")
    expect(t.length).toBeLessThanOrEqual(44)
    expect(t.endsWith("…")).toBe(true)
    expect(t).not.toMatch(/,…$/)
    expect(storyTitle("მოკლე")).toBe("მოკლე")
  })
  it("price labels never invent a price", () => {
    expect(storyPriceLabel({ isGift: true, priceGel: 50 })).toBe("უფასოდ")
    expect(storyPriceLabel({ isGift: false, priceGel: 0 })).toBe("ფასი შეთანხმებით")
    expect(storyPriceLabel({ isGift: false, priceGel: 49.6 })).toBe("50 ₾")
  })
})

describe("renderStoryJpeg (real sharp + bundled FiraGO)", () => {
  it("renders a 1080×1920 JPEG, including hostile markup in the title", async () => {
    const photo = await sharp({ create: { width: 600, height: 800, channels: 4, background: { r: 10, g: 120, b: 200, alpha: 0.6 } } }).webp().toBuffer()
    const out = await renderStoryJpeg(new Uint8Array(photo), { title: `<span foreground="red">ქურთუკი</span> & </b>`, priceLabel: "45 ₾", city: "ბათუმი" }, assets)
    const meta = await sharp(Buffer.from(out)).metadata()
    expect(meta).toMatchObject({ format: "jpeg", width: STORY_WIDTH, height: STORY_HEIGHT })
  }, 20000)
  it("fails closed on a broken photo", async () => {
    await expect(renderStoryJpeg(new Uint8Array([1, 2, 3]), { title: "x", priceLabel: "1 ₾", city: null }, assets)).rejects.toMatchObject({ code: "story_render_failed" })
  })
})

describe("createStoryPreparer", () => {
  const deps = (over = {}) => ({
    supabaseUrl: SUPA,
    fetcher: vi.fn(async () => new Response(new Uint8Array(10), { status: 200, headers: { "content-type": "image/webp" } })) as unknown as typeof fetch,
    upload: vi.fn(async () => undefined),
    digest: (s: string) => `d${s.length}`,
    assets: async () => assets,
    render: vi.fn(async () => new Uint8Array([0xff, 0xd8])),
    ...over,
  })
  it("uploads to social-media/stories/v1 and returns the public URL", async () => {
    const d = deps()
    const url = await createStoryPreparer(d)({ id: "l1", imageUrl: PHOTO_URL, title: "x", priceLabel: "1 ₾", city: null })
    expect(url).toMatch(new RegExp(`^${SUPA}/storage/v1/object/public/social-media/stories/v1/d\\d+\\.jpg$`))
    expect(d.upload).toHaveBeenCalledOnce()
    expect(d.fetcher).toHaveBeenCalledWith(PHOTO_URL, expect.objectContaining({ redirect: "error" }))
  })
  it("refuses foreign or missing photos without any network call", async () => {
    for (const imageUrl of ["https://evil.example/a.webp", null]) {
      const d = deps()
      await expect(createStoryPreparer(d)({ id: "l1", imageUrl, title: "x", priceLabel: "1 ₾", city: null })).rejects.toBeInstanceOf(MediaPrepareError)
      expect(d.fetcher).not.toHaveBeenCalled()
    }
  })
})

describe("story draft + QA", () => {
  const feed = { idempotencyKey: "plan:2026-11-09:0:featured_listing", pillar: "featured_listing" as const, scheduledFor: "2026-11-09T15:00:00.000Z", platforms: ["instagram" as const, "facebook" as const] }
  it("is a separate post, an hour after the feed post, with the listing link", () => {
    const d = createStoryDraft(feed, listing(1), `${SUPA}/storage/v1/object/public/social-media/stories/v1/a.jpg`)
    expect(d).toMatchObject({ idempotencyKey: storyKey(feed.idempotencyKey), contentType: "story", hashtags: [], listingId: "l1", scheduledFor: new Date(Date.parse(feed.scheduledFor) + STORY_DELAY_MINUTES * 60_000).toISOString() })
    expect(d.linkUrl).toContain("/listing/item-1?")
    expect(checkQuality(d, new Date("2026-11-06T10:00:00Z")).passed).toBe(true)
  })
  it("QA rejects a Story whose image is not a single JPEG", () => {
    const d = createStoryDraft(feed, listing(1), PHOTO_URL)
    expect(checkQuality(d, new Date("2026-11-06T10:00:00Z")).issues.map(i => i.code)).toContain("story_media")
  })
})

describe("orchestrator", () => {
  const storyUrl = (l: { id: string }) => `${SUPA}/storage/v1/object/public/social-media/stories/v1/${l.id}.jpg`
  function setup(control = {}) {
    let now = new Date("2026-11-06T10:00:00Z")
    const store = new MemorySocialStore(() => now, { killSwitch: false, storiesEnabled: true, ...control })
    store.listings = LISTINGS
    const prepareStory = vi.fn(async (l: { id: string }) => storyUrl(l))
    return { store, prepareStory, ctx: { store, runtime: preview, now: () => now, prepareStory }, advance: (iso: string) => { now = new Date(iso) }, clock: () => now.getTime() }
  }

  it("planning adds a Story companion only to product posts, and only when enabled", async () => {
    const { ctx, store } = setup()
    const r = await runPlanningCycle(ctx, { weekStart: "2026-11-09", listings: LISTINGS })
    const stories = [...store.posts.values()].filter(p => p.contentType === "story")
    const productFeeds = [...store.posts.values()].filter(p => p.contentType !== "story" && (p.pillar === "featured_listing" || p.pillar === "giveaway"))
    expect(stories).toHaveLength(productFeeds.length)
    expect(r.storiesCreated).toBe(stories.length)
    for (const s of stories) {
      expect(s.status).toBe("ready_for_review")
      expect(s.platforms).toEqual(["instagram", "facebook"])
    }
    expect(store.approvals.filter(a => stories.some(s => s.id === a.postId))).toHaveLength(stories.length)

    const off = setup({ storiesEnabled: false })
    await runPlanningCycle(off.ctx, { weekStart: "2026-11-09", listings: LISTINGS })
    expect([...off.store.posts.values()].some(p => p.contentType === "story")).toBe(false)
    expect(off.prepareStory).not.toHaveBeenCalled()
  })

  it("a failed render is audited and never blocks the feed post", async () => {
    const { ctx, store } = setup()
    ctx.prepareStory.mockRejectedValue(new MediaPrepareError("story_render_failed"))
    const r = await runPlanningCycle(ctx, { weekStart: "2026-11-09", listings: LISTINGS })
    expect(r.storiesCreated).toBe(0)
    expect(r.passedQa).toBe(r.created)
    expect(store.audit.some(a => a.reason === "story_render_failed" && a.decision === "failure")).toBe(true)
  })

  it("admin '🎬 Story-ც' is idempotent and respects the toggle", async () => {
    const { ctx, store } = setup({ storiesEnabled: false })
    const plan = await runPlanningCycle(ctx, { weekStart: "2026-11-09", listings: LISTINGS })
    const feed = plan.posts.find(p => p.pillar === "featured_listing")!
    await expect(addStoryForPost(ctx, feed.id, ADMIN)).rejects.toThrow(PolicyDeniedError)
    await store.updateControl({ storiesEnabled: true })
    const a = await addStoryForPost(ctx, feed.id, ADMIN)
    const b = await addStoryForPost(ctx, feed.id, ADMIN)
    expect(a.id).toBe(b.id)
    expect(ctx.prepareStory).toHaveBeenCalledOnce()
    const trust = plan.posts.find(p => p.pillar === "trust" || p.pillar === "how_to_sell")!
    await expect(addStoryForPost(ctx, trust.id, ADMIN)).rejects.toMatchObject({ code: "story_needs_listing_post" })
  })

  it("one approval queues feed + Story; the dry-run worker publishes each exactly once", async () => {
    const { ctx, store, advance, clock } = setup()
    const plan = await runPlanningCycle(ctx, { weekStart: "2026-11-09", listings: LISTINGS })
    const feed = plan.posts.find(p => p.pillar === "featured_listing" && p.contentType !== "story")!
    const story = (await store.getPostByKey(storyKey(feed.idempotencyKey)))!
    const r = await approvePostAndStory(ctx, feed.id, feed.version, ADMIN)
    expect(r.story?.jobs).toBe(2)
    expect((await store.getPost(story.id))!.status).toBe("scheduled")
    advance(new Date(Date.parse(story.scheduledFor) + 60_000).toISOString())
    for (let i = 0; i < 5; i++) await runPublishTick({ store, runtime: preview, now: clock })
    const storyJobs = [...store.jobs.values()].filter(j => j.postId === story.id)
    expect(storyJobs.map(j => j.status).sort()).toEqual(["dry_run_completed", "dry_run_completed"])
  })
})

describe("Meta adapters (mocked Graph API)", () => {
  const TOKEN = "EAAG-super-secret-token-value"
  const creds: MetaCredentials = { igToken: TOKEN, pageToken: TOKEN, igHost: "graph.facebook.com", version: "v27.0", igUserId: "17841400000000000", pageId: "100000000000001" }
  const input = { idempotencyKey: "social:s:v1:x:live", caption: "Story · ნივთი", hashtags: [], mediaUrls: [`${SUPA}/storage/v1/object/public/social-media/stories/v1/a.jpg`], linkUrl: null, contentType: "story" as const, existingContainerId: null }
  function fake(responses: Array<[number, unknown]>) {
    const calls: Array<{ url: string; body: string | null }> = []
    const fn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: (init.body as string) ?? null })
      const next = responses.shift()
      if (!next) throw new Error("unexpected call")
      return new Response(JSON.stringify(next[1]), { status: next[0] })
    })
    return { fn: fn as unknown as typeof fetch, calls }
  }

  it("Instagram: STORIES container without caption, then media_publish", async () => {
    const { fn, calls } = fake([[200, { id: "1790001" }], [200, { status_code: "FINISHED" }], [200, { id: "1790099" }]])
    const r = await new InstagramLiveAdapter(creds, new MetaGraphClient(igTarget(creds), fn), async () => undefined).publish(input, { recordContainer: async () => undefined })
    expect(r.externalPostId).toBe("1790099")
    expect(calls[0].body).toContain("media_type=STORIES")
    expect(calls[0].body).not.toContain("caption")
  })

  it("Facebook: unpublished photo upload, then photo_stories; a failure there is unknown_outcome", async () => {
    const PAGE = "EAAPAGE-page-token-value-0000"
    const ok = fake([[200, { access_token: PAGE }], [200, { id: "555" }], [200, { success: true, post_id: "777" }]])
    const r = await new FacebookLiveAdapter(creds, new MetaGraphClient(pageTarget(creds), ok.fn), ok.fn).publish(input)
    expect(r.externalPostId).toBe("777")
    expect(ok.calls[1].url).toContain("/100000000000001/photos")
    expect(ok.calls[1].body).toContain("published=false")
    expect(ok.calls[2].url).toContain("/100000000000001/photo_stories")
    expect(ok.calls[2].body).toContain("photo_id=555")

    const bad = fake([[200, { access_token: PAGE }], [200, { id: "555" }], [500, { error: { code: 1 } }]])
    await expect(new FacebookLiveAdapter(creds, new MetaGraphClient(pageTarget(creds), bad.fn), bad.fn).publish(input)).rejects.toMatchObject({ code: "unknown_outcome", retryable: false })
  })
})
