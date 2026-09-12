import "server-only"
import { timingSafeEqual } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const STORY_PRODUCTION_REF = "lxsvjzbiuewgwpajqrwr"
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const PATH = new RegExp(`^${UUID}/${UUID}/${UUID}\\.(jpg|png|webp|mp4|webm)$`)
const LIMIT = 100

export function cleanupAuthorized(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !header) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const supplied = Buffer.from(header)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function validateCleanupProject(url: string | undefined, ref: string | undefined) {
  if (ref !== STORY_PRODUCTION_REF || url !== `https://${STORY_PRODUCTION_REF}.supabase.co`) throw new Error("cleanup_project_mismatch")
}

/** Only DB-selected paths; body/query parameters never influence deletion. */
export async function runStoryCleanup(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_expired_story_media_for_cleanup", { p_limit: LIMIT })
  if (error || !Array.isArray(data) || data.length > LIMIT) throw new Error("cleanup_candidates_failed")
  const paths: string[] = data.map((row) => row.media_path)
  if (paths.some((path) => typeof path !== "string" || !PATH.test(path))) throw new Error("cleanup_invalid_path")
  // Deletion via Storage API removes bytes and metadata. SQL never deletes storage.objects.
  if (paths.length) {
    const { error: removalError } = await client.storage.from("story-media").remove([...new Set(paths)])
    if (removalError) throw new Error("cleanup_storage_failed")
  }
  const { data: pruned, error: pruneError } = await client.rpc("prune_unpublished_story_upload_plans", { p_limit: LIMIT })
  if (pruneError) throw new Error("cleanup_plans_failed")
  return { selected: paths.length, pruned, atCapacity: paths.length === LIMIT }
}

export function createStoryCleanupClient() {
  validateCleanupProject(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.STORY_CLEANUP_PROJECT_REF)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("cleanup_credentials_missing")
  return createClient(`https://${STORY_PRODUCTION_REF}.supabase.co`, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
  })
}
