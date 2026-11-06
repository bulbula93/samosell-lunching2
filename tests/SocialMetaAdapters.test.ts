// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { classifyGraphError, createAdapter, DryRunAdapter, FacebookLiveAdapter, igTarget, InstagramLiveAdapter, MetaGraphClient, pageTarget, PublishError, readMetaCredentials, type MetaCredentials } from "@/lib/social/adapters/meta"

const TOKEN = "EAAG-super-secret-token-value"
const creds: MetaCredentials = { igToken: TOKEN, pageToken: TOKEN, igHost: "graph.instagram.com", version: "v23.0", appSecret: "app-secret", igUserId: "17841400000000000", pageId: "100000000000001" }
const input = { idempotencyKey: "social:p:v1:instagram:live", caption: "✨ დღის აღმოჩენა SamoSell-ზე ტესტი", hashtags: ["samosell"], mediaUrls: ["https://samosell.ge/a.jpg"], linkUrl: "https://samosell.ge/", contentType: "single_image" as const, existingContainerId: null }

type Call = { method: string; url: string; body: string | null; auth: string | null }
function fakeFetch(responses: Array<[number, unknown] | Error>) {
  const calls: Call[] = []
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ method: String(init.method), url, body: (init.body as string) ?? null, auth: (init.headers as Record<string, string>).Authorization ?? null })
    const next = responses.shift()
    if (!next) throw new Error("unexpected call")
    if (next instanceof Error) throw next
    return new Response(JSON.stringify(next[1]), { status: next[0] })
  })
  return { fn: fn as unknown as typeof fetch, calls }
}

describe("dry-run adapter", () => {
  it("never touches the network and is deterministic", async () => {
    const spy = vi.spyOn(globalThis, "fetch")
    const hooks = { recordContainer: vi.fn(async () => undefined) }
    const a = await new DryRunAdapter("instagram").publish(input, hooks)
    const b = await new DryRunAdapter("instagram").publish(input, { recordContainer: async () => undefined })
    expect(a.externalPostId).toBe(b.externalPostId)
    expect(a.externalPostId).toMatch(/^dryrun_ig_[a-f0-9]{24}$/)
    expect(hooks.recordContainer).toHaveBeenCalledOnce()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it("factory returns dry-run unless mode is live; live without credentials is refused", () => {
    expect(createAdapter("facebook", "dry_run", creds).mode).toBe("dry_run")
    expect(() => createAdapter("facebook", "live", null)).toThrow("meta_credentials_missing")
  })
  it("credentials parser rejects malformed configuration", () => {
    expect(readMetaCredentials({})).toBeNull()
    // Both tokens are required; a Page token alone never enables Instagram (or vice versa).
    expect(readMetaCredentials({ META_SOCIAL_PAGE_ACCESS_TOKEN: "x", META_SOCIAL_GRAPH_API_VERSION: "v23.0", META_SOCIAL_IG_USER_ID: "17841400000000000", META_SOCIAL_PAGE_ID: "100000000000001" })).toBeNull()
    expect(readMetaCredentials({ META_SOCIAL_PAGE_ACCESS_TOKEN: "x", META_SOCIAL_IG_ACCESS_TOKEN: "y", META_SOCIAL_GRAPH_API_VERSION: "v23.0", META_SOCIAL_IG_USER_ID: "17841400000000000", META_SOCIAL_PAGE_ID: "100000000000001" })?.igHost).toBe("graph.instagram.com")
    expect(readMetaCredentials({ META_SOCIAL_PAGE_ACCESS_TOKEN: "x", META_SOCIAL_GRAPH_API_VERSION: "latest", META_SOCIAL_IG_USER_ID: "1", META_SOCIAL_PAGE_ID: "2" })).toBeNull()
  })
})

describe("Instagram live adapter (mocked Graph API)", () => {
  it("creates container, records it BEFORE publish, publishes, and sends the token only in the header", async () => {
    const { fn, calls } = fakeFetch([[200, { id: "1790001" }], [200, { status_code: "FINISHED" }], [200, { id: "1790099" }]])
    const order: string[] = []
    const adapter = new InstagramLiveAdapter(creds, new MetaGraphClient(igTarget(creds), fn), async () => undefined)
    const r = await adapter.publish(input, { recordContainer: async id => { order.push(`record:${id}`); expect(calls).toHaveLength(1) } })
    expect(r).toEqual({ externalPostId: "1790099", containerId: "1790001" })
    expect(order).toEqual(["record:1790001"])
    expect(calls.map(c => c.method)).toEqual(["POST", "GET", "POST"])
    expect(calls[2].url).toContain("/media_publish")
    expect(calls.every(c => c.url.startsWith("https://graph.instagram.com/v23.0/"))).toBe(true)
    for (const c of calls) {
      expect(c.auth).toBe(`Bearer ${TOKEN}`)
      expect(c.url).not.toContain(TOKEN)
      expect(c.body ?? "").not.toContain(TOKEN)
    }
  })
  it("resumes an existing container instead of creating a second one", async () => {
    const { fn, calls } = fakeFetch([[200, { status_code: "FINISHED" }], [200, { id: "1790100" }]])
    const r = await new InstagramLiveAdapter(creds, new MetaGraphClient(igTarget(creds), fn), async () => undefined).publish({ ...input, existingContainerId: "1790001" }, { recordContainer: async () => { throw new Error("must not create") } })
    expect(r.externalPostId).toBe("1790100")
    expect(calls.some(c => c.url.endsWith("/media") && c.method === "POST")).toBe(false)
  })
  it("a container that is already PUBLISHED is never re-published", async () => {
    const { fn } = fakeFetch([[200, { status_code: "PUBLISHED" }]])
    await expect(new InstagramLiveAdapter(creds, new MetaGraphClient(igTarget(creds), fn), async () => undefined).publish({ ...input, existingContainerId: "1790001" }, { recordContainer: async () => undefined })).rejects.toMatchObject({ code: "container_already_published", retryable: false })
  })
  it("timeout during media_publish is an unknown outcome, never auto-retried", async () => {
    const { fn } = fakeFetch([[200, { status_code: "FINISHED" }], new Error("aborted")])
    await expect(new InstagramLiveAdapter(creds, new MetaGraphClient(igTarget(creds), fn), async () => undefined).publish({ ...input, existingContainerId: "1790001" }, { recordContainer: async () => undefined })).rejects.toMatchObject({ code: "unknown_outcome", retryable: false })
  })
  it("errors never include the token or provider message", async () => {
    const { fn } = fakeFetch([[400, { error: { code: 190, message: `bad token ${TOKEN}` } }]])
    const err = await new InstagramLiveAdapter(creds, new MetaGraphClient(igTarget(creds), fn), async () => undefined).publish(input, { recordContainer: async () => undefined }).catch(e => e)
    expect(err).toBeInstanceOf(PublishError)
    expect(err.code).toBe("meta_token_invalid")
    expect(JSON.stringify({ ...err, message: err.message })).not.toContain(TOKEN)
  })
})

describe("Facebook live adapter and error classification", () => {
  it("single image uses /photos and returns the post id", async () => {
    const { fn, calls } = fakeFetch([[200, { id: "555", post_id: "100000000000001_777" }]])
    const r = await new FacebookLiveAdapter(creds, new MetaGraphClient(pageTarget(creds), fn)).publish({ ...input })
    expect(r.externalPostId).toBe("100000000000001_777")
    expect(calls[0].url).toContain("https://graph.facebook.com/v23.0/100000000000001/photos")
    expect(calls[0].body).toContain("appsecret_proof=")
  })
  it("classifies errors by side effect", () => {
    expect(classifyGraphError(400, { error: { code: 4 } }, true)).toMatchObject({ code: "meta_rate_limited", retryable: true })
    expect(classifyGraphError(500, {}, false)).toMatchObject({ code: "meta_api_unavailable", retryable: true })
    expect(classifyGraphError(500, {}, true)).toMatchObject({ code: "unknown_outcome", retryable: false })
    expect(classifyGraphError(403, { error: { code: 200 } }, true)).toMatchObject({ code: "meta_permission_denied", retryable: false })
    expect(classifyGraphError(400, { error: { code: 9007 } }, true)).toMatchObject({ code: "meta_media_not_ready", retryable: true })
  })
})
