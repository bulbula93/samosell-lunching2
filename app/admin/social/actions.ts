"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdminUser } from "@/lib/auth"
import { createAdapter, PublishError, readMetaCredentials } from "@/lib/social/adapters/meta"
import { addStoryForPost, approvePostAndStory, draftAdForPost, enableInstagramForPost, PolicyDeniedError, rejectPost, runPlanningCycle, runQualityCheck } from "@/lib/social/orchestrator"
import { evaluateSocialAction } from "@/lib/social/policy-gateway"
import { currentSocialRuntime } from "@/lib/social/runtime"
import { SocialStoreError, type ReviewResolution, type SocialStore } from "@/lib/social/store"
import { MediaPrepareError } from "@/lib/social/media"
import { createSocialMediaPreparer, createSocialStoryPreparer } from "@/lib/social/supabase-media"
import { createSocialStore } from "@/lib/social/supabase-store"
import { runPublishTick } from "@/lib/social/worker"
import { syncInsights } from "@/lib/social/insights"

const PATH = "/admin/social"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function go(type: "ok" | "error", code: string, section?: "plan" | "publishing" | "results"): never {
  revalidatePath(PATH)
  // `at` tells the page where to show the message; the hash scrolls there.
  redirect(`${PATH}?${type}=${encodeURIComponent(code)}${section ? `&at=${section}#${section}` : ""}`)
}

/** Every action: authenticate as admin FIRST, then resolve the fail-closed backend. */
async function context() {
  const { user } = await requireAdminUser("/dashboard")
  const runtime = currentSocialRuntime()
  const store = createSocialStore(runtime)
  if (!store) go("error", runtime.backendReason)
  return { user, runtime, store: store as SocialStore }
}

function errorCode(error: unknown) {
  if (error instanceof PolicyDeniedError) return error.reason
  if (error instanceof SocialStoreError) return error.code
  if (error instanceof MediaPrepareError) return error.code
  return "action_failed"
}
function readPost(formData: FormData) {
  const postId = String(formData.get("postId") ?? "")
  const version = Number(formData.get("version"))
  if (!UUID.test(postId) || !Number.isInteger(version) || version < 1) go("error", "invalid_input")
  return { postId, version }
}

export async function runPlanningAction(formData: FormData) {
  const { store, runtime } = await context()
  const target = formData.get("target") === "current" ? "current" : "next"
  let code: string
  try {
    const r = await runPlanningCycle({ store, runtime, prepareMedia: createSocialMediaPreparer(runtime), prepareStory: createSocialStoryPreparer(runtime) }, { target })
    // Machine-readable result; the page turns it into a Georgian sentence next to the button.
    code = `plan_${target}_${r.created}_${r.storiesCreated}_${r.failedQa}_${r.existing}`
  } catch (e) { go("error", errorCode(e), "plan") }
  go("ok", code, "plan")
}

/** Admin decision for a job stuck in needs_review. Instagram is re-checked on Meta before any resend. */
export async function resolveJobAction(formData: FormData) {
  const { store, runtime, user } = await context()
  const jobId = String(formData.get("jobId") ?? "")
  const choice = String(formData.get("choice") ?? "")
  if (!UUID.test(jobId) || !["confirm_published", "resend", "cancel"].includes(choice)) go("error", "invalid_input", "publishing")
  let code: string
  try {
    const job = await store.getJob(jobId)
    if (!job || job.status !== "needs_review") throw new SocialStoreError("job_not_in_review")
    let resolution: ReviewResolution = choice === "confirm_published" ? "published" : choice === "cancel" ? "cancel" : "requeue_fresh"
    let externalId: string | null = choice === "confirm_published" ? `manual_confirmed:${new Date().toISOString().slice(0, 10)}` : null
    if (choice === "resend" && job.platform === "instagram" && job.externalContainerId && runtime.executionModeCeiling === "live") {
      // Never trust memory for Instagram: if the container went public, record it instead of resending.
      const status = await createAdapter("instagram", "live", readMetaCredentials()).containerStatus?.(job.externalContainerId)
      if (status === "PUBLISHED") { resolution = "published"; externalId = `ig_container:${job.externalContainerId}` }
      else if (status === "FINISHED" || status === "IN_PROGRESS") resolution = "requeue_resume"
    }
    const next = await store.resolveReviewJob(jobId, resolution, externalId)
    await store.appendAudit({ actorType: "human", actor: user.id, action: "publish_organic", decision: "allow", reason: `review_admin_${resolution}`, resourceType: "social_publish_job", resourceId: jobId, details: { platform: job.platform, choice, next } })
    code = `review_${resolution}`
  } catch (e) { go("error", e instanceof PublishError ? "meta_check_failed" : errorCode(e), "publishing") }
  go("ok", code, "publishing")
}

export async function approvePostAction(formData: FormData) {
  const { store, runtime, user } = await context()
  const { postId, version } = readPost(formData)
  let code: string
  try {
    const r = await approvePostAndStory({ store, runtime }, postId, version, user.id)
    code = `approved_${r.feed.jobs}_jobs_${r.feed.mode}${r.story ? `_story_${r.story.jobs}_jobs` : ""}`
  } catch (e) { go("error", errorCode(e)) }
  go("ok", code)
}

export async function enableInstagramAction(formData: FormData) {
  const { store, runtime, user } = await context()
  const { postId, version } = readPost(formData)
  try { await enableInstagramForPost({ store, runtime, prepareMedia: createSocialMediaPreparer(runtime) }, postId, version, user.id) } catch (e) { go("error", errorCode(e)) }
  go("ok", "instagram_media_prepared_qa_rerun")
}

export async function addStoryAction(formData: FormData) {
  const { store, runtime, user } = await context()
  const { postId } = readPost(formData)
  try { await addStoryForPost({ store, runtime, prepareStory: createSocialStoryPreparer(runtime) }, postId, user.id) } catch (e) { go("error", errorCode(e)) }
  go("ok", "story_created_awaiting_approval")
}

export async function rejectPostAction(formData: FormData) {
  const { store, runtime, user } = await context()
  const { postId, version } = readPost(formData)
  try { await rejectPost({ store, runtime }, postId, version, user.id) } catch (e) { go("error", errorCode(e)) }
  go("ok", "rejected")
}

export async function editCaptionAction(formData: FormData) {
  const { store, runtime, user } = await context()
  const { postId } = readPost(formData)
  const caption = String(formData.get("caption") ?? "").replace(/\r\n/g, "\n").trim()
  if (caption.length < 1 || caption.length > 2200) go("error", "caption_length")
  try {
    const control = await store.getControl()
    const decision = evaluateSocialAction({ actor: "human_admin", action: "edit_draft", runtime, control })
    if (decision.decision === "deny") throw new PolicyDeniedError(decision.reason)
    const updated = await store.updatePostContent(postId, { caption })
    await store.appendAudit({ actorType: "human", actor: user.id, action: "edit_draft", decision: "success", reason: "caption_edited", resourceType: "social_post", resourceId: postId, details: { version: updated.version } })
    // Edits always re-run QA; a fresh approval request is created only if QA passes.
    const checked = await runQualityCheck({ store, runtime }, updated, "human_admin")
    if (checked.qualityPassed) await store.requestApproval(checked.id, checked.version)
  } catch (e) { go("error", errorCode(e)) }
  go("ok", "caption_saved_qa_rerun")
}

export async function rerunQualityAction(formData: FormData) {
  const { store, runtime } = await context()
  const { postId, version } = readPost(formData)
  try {
    const post = await store.getPost(postId)
    if (!post || post.version !== version) throw new SocialStoreError("stale_version")
    const checked = await runQualityCheck({ store, runtime }, post, "human_admin")
    if (checked.qualityPassed) await store.requestApproval(checked.id, checked.version)
  } catch (e) { go("error", errorCode(e)) }
  go("ok", "qa_rerun")
}

export async function draftAdAction(formData: FormData) {
  const { store, runtime } = await context()
  const { postId } = readPost(formData)
  try { await draftAdForPost({ store, runtime }, postId) } catch (e) { go("error", errorCode(e)) }
  go("ok", "ad_draft_created_zero_budget")
}

export async function killSwitchAction(formData: FormData) {
  const { store, runtime, user } = await context()
  const engage = formData.get("engage") === "true"
  try {
    const control = await store.getControl()
    const action = engage ? "kill_switch_on" : "kill_switch_off"
    const decision = evaluateSocialAction({ actor: "human_admin", action, runtime, control })
    if (decision.decision === "deny") throw new PolicyDeniedError(decision.reason)
    await store.updateControl({ killSwitch: engage }, user.id)
    await store.appendAudit({ actorType: "human", actor: user.id, action, decision: "success", reason: decision.reason, resourceType: "social_control", resourceId: "singleton" })
  } catch (e) { go("error", errorCode(e)) }
  go("ok", engage ? "kill_switch_engaged" : "kill_switch_released")
}

export async function settingsAction(formData: FormData) {
  const { store, runtime, user } = await context()
  const patch = {
    instagramEnabled: formData.get("instagram") === "on",
    facebookEnabled: formData.get("facebook") === "on",
    organicAutoPublish: formData.get("autoPublish") === "on",
    storiesEnabled: formData.get("stories") === "on",
    executionMode: formData.get("executionMode") === "live" ? "live" as const : "dry_run" as const,
  }
  try {
    const control = await store.getControl()
    const decision = evaluateSocialAction({ actor: "human_admin", action: "change_settings", runtime, control, settings: patch })
    if (decision.decision === "deny") throw new PolicyDeniedError(decision.reason)
    await store.updateControl(patch, user.id)
    await store.appendAudit({ actorType: "human", actor: user.id, action: "change_settings", decision: "success", reason: "settings_saved", resourceType: "social_control", resourceId: "singleton", details: { instagram: patch.instagramEnabled, facebook: patch.facebookEnabled, auto_publish: patch.organicAutoPublish, stories: patch.storiesEnabled, mode: patch.executionMode } })
  } catch (e) { go("error", errorCode(e)) }
  go("ok", "settings_saved")
}

/** Manual worker tick from the admin UI (same code path as the protected cron route). */
export async function runTickAction() {
  const { store, runtime } = await context()
  let code: string
  try {
    const credentials = runtime.executionModeCeiling === "live" ? readMetaCredentials() : null
    // Server actions share the route's budget; keep the same deadline as the cron route.
    const r = await runPublishTick({ store, runtime, credentials, maxJobs: 3, deadlineMs: 25_000 })
    code = `tick_${r.state}_${r.completed}_done_${r.failed}_failed`
  } catch (e) { go("error", errorCode(e)) }
  go("ok", code)
}

/** Manual "refresh results": the same read-only sync the daily cron runs. */
export async function syncInsightsAction() {
  const { store, runtime } = await context()
  let r: Awaited<ReturnType<typeof syncInsights>>
  try {
    const credentials = runtime.executionModeCeiling === "live" ? readMetaCredentials() : null
    r = await syncInsights({ store, runtime, credentials })
  } catch (e) { go("error", errorCode(e), "results") }
  // Outside the try: redirect() works by throwing and must not be caught above.
  if (r.state !== "ran") go("error", r.firstError ?? "insights_failed", "results")
  go("ok", `insights_${r.posts}_${r.updated}_${r.failed}`, "results")
}
