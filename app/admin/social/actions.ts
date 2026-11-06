"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdminUser } from "@/lib/auth"
import { readMetaCredentials } from "@/lib/social/adapters/meta"
import { approveAndSchedule, draftAdForPost, PolicyDeniedError, rejectPost, runPlanningCycle, runQualityCheck } from "@/lib/social/orchestrator"
import { evaluateSocialAction } from "@/lib/social/policy-gateway"
import { currentSocialRuntime } from "@/lib/social/runtime"
import { SocialStoreError, type SocialStore } from "@/lib/social/store"
import { createSocialStore } from "@/lib/social/supabase-store"
import { runPublishTick } from "@/lib/social/worker"

const PATH = "/admin/social"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function go(type: "ok" | "error", code: string): never {
  revalidatePath(PATH)
  redirect(`${PATH}?${type}=${encodeURIComponent(code)}`)
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
  return "action_failed"
}
function readPost(formData: FormData) {
  const postId = String(formData.get("postId") ?? "")
  const version = Number(formData.get("version"))
  if (!UUID.test(postId) || !Number.isInteger(version) || version < 1) go("error", "invalid_input")
  return { postId, version }
}

export async function runPlanningAction() {
  const { store, runtime } = await context()
  let code: string
  try {
    const r = await runPlanningCycle({ store, runtime })
    code = `planned_${r.created}_created_${r.passedQa}_qa_passed`
  } catch (e) { go("error", errorCode(e)) }
  go("ok", code)
}

export async function approvePostAction(formData: FormData) {
  const { store, runtime, user } = await context()
  const { postId, version } = readPost(formData)
  let code: string
  try {
    const r = await approveAndSchedule({ store, runtime }, postId, version, user.id)
    code = `approved_${r.jobs}_jobs_${r.mode}`
  } catch (e) { go("error", errorCode(e)) }
  go("ok", code)
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
    executionMode: formData.get("executionMode") === "live" ? "live" as const : "dry_run" as const,
  }
  try {
    const control = await store.getControl()
    const decision = evaluateSocialAction({ actor: "human_admin", action: "change_settings", runtime, control, settings: patch })
    if (decision.decision === "deny") throw new PolicyDeniedError(decision.reason)
    await store.updateControl(patch, user.id)
    await store.appendAudit({ actorType: "human", actor: user.id, action: "change_settings", decision: "success", reason: "settings_saved", resourceType: "social_control", resourceId: "singleton", details: { instagram: patch.instagramEnabled, facebook: patch.facebookEnabled, auto_publish: patch.organicAutoPublish, mode: patch.executionMode } })
  } catch (e) { go("error", errorCode(e)) }
  go("ok", "settings_saved")
}

/** Manual worker tick from the admin UI (same code path as the protected cron route). */
export async function runTickAction() {
  const { store, runtime } = await context()
  let code: string
  try {
    const credentials = runtime.executionModeCeiling === "live" ? readMetaCredentials() : null
    const r = await runPublishTick({ store, runtime, credentials, maxJobs: 3, deadlineMs: 20_000 })
    code = `tick_${r.state}_${r.completed}_done_${r.failed}_failed`
  } catch (e) { go("error", errorCode(e)) }
  go("ok", code)
}
