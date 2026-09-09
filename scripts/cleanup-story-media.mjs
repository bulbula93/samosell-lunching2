/** Run with trusted non-production credentials. No .env file is loaded implicitly.
 * STORY_CLEANUP_PROJECT_REF must equal the explicit Supabase URL host prefix.
 * Dry run: node scripts/cleanup-story-media.mjs
 * Remove candidates: node scripts/cleanup-story-media.mjs --apply
 */
import { createClient } from "@supabase/supabase-js"
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const ref = process.env.STORY_CLEANUP_PROJECT_REF
if (!url || !ref || new URL(url).hostname !== `${ref}.supabase.co` || ref === "lxsvjzbiuewgwpajqrwr") {
  throw new Error("Explicit non-production Supabase project required; production cleanup is disabled in this PR.")
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing server credentials")
const client = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await client.rpc("list_expired_story_media_for_cleanup", { p_limit: 500 })
if (error) throw new Error("Story cleanup candidate query failed")
console.log(`${data.length} media objects eligible for cleanup`)
if (process.argv.includes("--apply")) {
  for (let offset = 0; offset < data.length; offset += 100) {
    const paths = data.slice(offset, offset + 100).map(row => row.media_path)
    const { error: removalError } = await client.storage.from("story-media").remove(paths)
    if (removalError) throw new Error("Story media removal failed; rerun to retry")
  }
  // Token maximum lifetime is two hours; old unused plan rows need not accumulate.
  // Published plans are retained as validation evidence, bounded by Story creation.
  const { error: planError } = await client.from("story_upload_plans").delete()
    .is("published_at", null).lt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  if (planError) throw new Error("Story plan cleanup failed; rerun to retry")
  console.log("Story cleanup completed")
}
