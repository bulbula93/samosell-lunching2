/**
 * Server-side publishing adapters for Instagram (Content Publishing API) and Facebook Pages.
 *
 * Duplicate-publishing rules:
 *  - The worker persists the Instagram container id BEFORE calling media_publish, so a retry
 *    resumes the same container instead of creating a second public post.
 *  - Any failure after a non-idempotent "make public" request was sent (IG media_publish,
 *    FB /photos or /feed) is classified `unknown_outcome` → the job goes to needs_review,
 *    never to automatic retry. A human checks the Page before anything is re-sent.
 *  - Only safe steps (GET status, IG container creation, which is never public) are retried.
 *
 * Secrets: the token is sent in the Authorization header and is never included in errors,
 * return values, audit details or logs.
 */
import { createHash, createHmac } from "node:crypto"
import { renderCaption } from "../agents/creative"
import type { ContentType, ExecutionMode, SocialPlatform } from "../types"

export class PublishError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean) { super(code) }
}

export type PublishInput = {
  idempotencyKey: string
  caption: string
  hashtags: string[]
  mediaUrls: string[]
  linkUrl: string | null
  contentType: ContentType
  existingContainerId: string | null
}
export type PublishHooks = { recordContainer: (containerId: string) => Promise<void> }
export type PublishResult = { externalPostId: string; containerId?: string }
export interface PublishAdapter {
  readonly platform: SocialPlatform
  readonly mode: ExecutionMode
  publish(input: PublishInput, hooks: PublishHooks): Promise<PublishResult>
}

/** Dry-run: validates the payload exactly like live, makes no network call, returns a deterministic id. */
export class DryRunAdapter implements PublishAdapter {
  readonly mode = "dry_run" as const
  constructor(readonly platform: SocialPlatform) {}
  async publish(input: PublishInput, hooks: PublishHooks): Promise<PublishResult> {
    validatePayload(this.platform, input)
    const digest = createHash("sha256").update(`${this.platform}:${input.idempotencyKey}`).digest("hex").slice(0, 24)
    if (this.platform === "instagram") {
      const containerId = input.existingContainerId ?? `dryrun_container_${digest}`
      if (!input.existingContainerId) await hooks.recordContainer(containerId)
      return { externalPostId: `dryrun_ig_${digest}`, containerId }
    }
    return { externalPostId: `dryrun_fb_${digest}` }
  }
}

export function validatePayload(platform: SocialPlatform, input: PublishInput) {
  if (platform === "instagram" && input.mediaUrls.length === 0) throw new PublishError("instagram_media_required", false)
  if (input.contentType === "carousel" && (input.mediaUrls.length < 2 || input.mediaUrls.length > 10)) throw new PublishError("carousel_size", false)
  if (!input.mediaUrls.every(u => u.startsWith("https://"))) throw new PublishError("media_not_https", false)
}

/**
 * Two independent credentials (least privilege):
 *  - Facebook Page token (Facebook Login for Business / system user): pages_manage_posts, pages_read_engagement, pages_show_list.
 *  - Instagram token. Recommended: "Instagram API with Instagram Login" (graph.instagram.com) with
 *    instagram_business_basic + instagram_business_content_publish — it needs NO ads permissions.
 *    The Facebook-Login path (graph.facebook.com) requires ads_management + ads_read when the Page role
 *    comes through Business Manager, which would give the token ad-account power. Avoid that path.
 * Neither token may ever carry ads_management for this system; paid ads stay structurally impossible.
 */
export type MetaCredentials = {
  version: string
  appSecret?: string
  pageId: string
  pageToken: string
  igUserId: string
  igToken: string
  igHost: "graph.instagram.com" | "graph.facebook.com"
}

export function readMetaCredentials(env: Record<string, string | undefined> = process.env): MetaCredentials | null {
  const version = env.META_SOCIAL_GRAPH_API_VERSION ?? ""
  const pageToken = env.META_SOCIAL_PAGE_ACCESS_TOKEN
  const igToken = env.META_SOCIAL_IG_ACCESS_TOKEN
  const igUserId = env.META_SOCIAL_IG_USER_ID ?? ""
  const pageId = env.META_SOCIAL_PAGE_ID ?? ""
  const igHost = env.META_SOCIAL_IG_HOST === "graph.facebook.com" ? "graph.facebook.com" : "graph.instagram.com"
  if (!pageToken || !igToken || !/^v\d+\.0$/.test(version) || !/^\d{5,25}$/.test(igUserId) || !/^\d{5,25}$/.test(pageId)) return null
  return { version, appSecret: env.META_SOCIAL_APP_SECRET || undefined, igUserId, pageId, pageToken, igToken, igHost }
}

type Fetcher = typeof fetch
const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v))
const ID = /^[0-9_]{1,64}$/

/** Map a Graph API error to a stable code. `sideEffect` = the request may have made content public. */
export function classifyGraphError(status: number, body: unknown, sideEffect: boolean): PublishError {
  const e = isRecord(body) && isRecord(body.error) ? body.error : null
  const code = typeof e?.code === "number" ? e.code : null
  const sub = typeof e?.error_subcode === "number" ? e.error_subcode : null
  if (code === 190) return new PublishError("meta_token_invalid", false)
  if (code === 10 || (code !== null && code >= 200 && code < 300)) return new PublishError("meta_permission_denied", false)
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 9) return new PublishError("meta_rate_limited", true) // throttled requests are rejected, not executed
  if (code === 9007 || sub === 2207027) return new PublishError("meta_media_not_ready", true)
  if (code === 100 || code === 36003 || code === 352) return new PublishError("meta_invalid_request", false)
  if (status >= 500 || code === 1 || code === 2) return sideEffect ? new PublishError("unknown_outcome", false) : new PublishError("meta_api_unavailable", true)
  return new PublishError(sideEffect ? "unknown_outcome" : "meta_api_error", false)
}

export type GraphTarget = { host: "graph.instagram.com" | "graph.facebook.com"; token: string; version: string; appSecret?: string }
export const pageTarget = (c: MetaCredentials): GraphTarget => ({ host: "graph.facebook.com", token: c.pageToken, version: c.version, appSecret: c.appSecret })
export const igTarget = (c: MetaCredentials): GraphTarget => ({ host: c.igHost, token: c.igToken, version: c.version, appSecret: c.igHost === "graph.facebook.com" ? c.appSecret : undefined })

export class MetaGraphClient {
  constructor(private readonly target: GraphTarget, private readonly fetcher: Fetcher = fetch) {}

  async call(method: "GET" | "POST", path: string, params: Record<string, string>, sideEffect: boolean): Promise<Record<string, unknown>> {
    const url = new URL(`https://${this.target.host}/${this.target.version}/${path}`)
    const body = new URLSearchParams(params)
    if (this.target.appSecret) body.set("appsecret_proof", createHmac("sha256", this.target.appSecret).update(this.target.token).digest("hex"))
    if (method === "GET") body.forEach((value, key) => url.searchParams.set(key, value))
    let response: Response
    try {
      response = await this.fetcher(url.toString(), {
        method,
        headers: { Authorization: `Bearer ${this.target.token}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
        body: method === "POST" ? body.toString() : undefined,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      // Timeout/network after a public-making POST: the post may exist. Never retry blindly.
      throw new PublishError(sideEffect ? "unknown_outcome" : "meta_api_unavailable", !sideEffect)
    }
    let json: unknown = null
    try { json = await response.json() } catch { /* handled below */ }
    if (!response.ok || !isRecord(json) || json.error) throw classifyGraphError(response.status, json, sideEffect)
    return json
  }
}

export class InstagramLiveAdapter implements PublishAdapter {
  readonly platform = "instagram" as const
  readonly mode = "live" as const
  constructor(private readonly creds: MetaCredentials, private readonly client = new MetaGraphClient(igTarget(creds)), private readonly sleep = (ms: number) => new Promise(r => setTimeout(r, ms))) {}

  private async createContainer(input: PublishInput): Promise<string> {
    const caption = renderCaption(input, "instagram")
    const id = (r: Record<string, unknown>) => { if (typeof r.id !== "string" || !ID.test(r.id)) throw new PublishError("meta_invalid_response", false); return r.id }
    if (input.contentType === "carousel") {
      const children: string[] = []
      for (const image of input.mediaUrls) children.push(id(await this.client.call("POST", `${this.creds.igUserId}/media`, { image_url: image, is_carousel_item: "true" }, false)))
      return id(await this.client.call("POST", `${this.creds.igUserId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption }, false))
    }
    return id(await this.client.call("POST", `${this.creds.igUserId}/media`, { image_url: input.mediaUrls[0], caption }, false))
  }

  async publish(input: PublishInput, hooks: PublishHooks): Promise<PublishResult> {
    validatePayload("instagram", input)
    let containerId = input.existingContainerId
    if (!containerId) {
      containerId = await this.createContainer(input)
      await hooks.recordContainer(containerId) // persisted before anything can become public
    }
    // Bounded polling keeps one invocation short (Vercel CPU): max ~6s of waiting.
    for (let i = 0; i < 4; i++) {
      const status = await this.client.call("GET", containerId, { fields: "status_code" }, false)
      if (status.status_code === "FINISHED") break
      if (status.status_code === "PUBLISHED") throw new PublishError("container_already_published", false)
      if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new PublishError("container_failed", false)
      if (i === 3) throw new PublishError("meta_media_not_ready", true)
      await this.sleep(2000)
    }
    const published = await this.client.call("POST", `${this.creds.igUserId}/media_publish`, { creation_id: containerId }, true)
    if (typeof published.id !== "string" || !ID.test(published.id)) throw new PublishError("unknown_outcome", false)
    return { externalPostId: published.id, containerId }
  }
}

export class FacebookLiveAdapter implements PublishAdapter {
  readonly platform = "facebook" as const
  readonly mode = "live" as const
  constructor(private readonly creds: MetaCredentials, private readonly client = new MetaGraphClient(pageTarget(creds))) {}

  async publish(input: PublishInput): Promise<PublishResult> {
    validatePayload("facebook", input)
    const message = renderCaption(input, "facebook")
    const page = this.creds.pageId
    let result: Record<string, unknown>
    if (input.contentType === "single_image") {
      result = await this.client.call("POST", `${page}/photos`, { url: input.mediaUrls[0], message }, true)
      result = { id: result.post_id ?? result.id }
    } else if (input.contentType === "carousel") {
      // Unpublished photo uploads are not public; only the final /feed call is.
      const ids: string[] = []
      for (const url of input.mediaUrls) {
        const r = await this.client.call("POST", `${page}/photos`, { url, published: "false" }, false)
        if (typeof r.id !== "string" || !ID.test(r.id)) throw new PublishError("meta_invalid_response", false)
        ids.push(r.id)
      }
      const params: Record<string, string> = { message }
      ids.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }) })
      result = await this.client.call("POST", `${page}/feed`, params, true)
    } else {
      result = await this.client.call("POST", `${page}/feed`, { message, ...(input.linkUrl ? { link: input.linkUrl } : {}) }, true)
    }
    if (typeof result.id !== "string" || !ID.test(result.id)) throw new PublishError("unknown_outcome", false)
    return { externalPostId: result.id }
  }
}

/** The only factory the worker uses. Live adapters require mode=live AND valid credentials. */
export function createAdapter(platform: SocialPlatform, mode: ExecutionMode, creds: MetaCredentials | null): PublishAdapter {
  if (mode !== "live") return new DryRunAdapter(platform)
  if (!creds) throw new PublishError("meta_credentials_missing", false)
  return platform === "instagram" ? new InstagramLiveAdapter(creds) : new FacebookLiveAdapter(creds)
}
