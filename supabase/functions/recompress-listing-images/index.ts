import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.57.4"
import { readDefaultSupabaseSecretKey } from "../_shared/supabase-secret.ts"

// One-off maintenance (Nov 2026): replace oversized listing photos (>1 MB)
// with a 1600px re-encode produced by samosell.ge's own Next/Image optimizer.
// Each original is first copied server-side (no egress) into the private
// `listing-images-backup` bucket. Paths are unchanged, so listing URLs stay
// valid. Invoked only through public.request_listing_image_recompress().

const SOURCE_BUCKET = "listing-images"
const BACKUP_BUCKET = "listing-images-backup"
const OPTIMIZER = "https://samosell.ge/_next/image"
const MAX_RATIO = 0.7 // only replace when the result is at least 30% smaller

type Job = { path: string; mimetype: string; original_size: number }

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } })
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" })
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  let secretKey: string
  try {
    secretKey = readDefaultSupabaseSecretKey(Deno.env.get("SUPABASE_SECRET_KEYS"))
  } catch {
    return json(500, { error: "server_config_missing" })
  }
  const input = (await req.json().catch(() => ({}))) as { secret?: unknown; limit?: unknown; dryRun?: unknown }
  if (typeof input.secret !== "string") return json(401, { error: "invalid_secret" })
  const limit = typeof input.limit === "number" ? input.limit : 8
  const dryRun = input.dryRun === true

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin.rpc("claim_listing_image_recompress", { p_secret: input.secret, p_limit: limit })
  if (error) return json(401, { error: "claim_failed" })
  const jobs = (data ?? []) as Job[]

  const { data: bucket } = await admin.storage.getBucket(BACKUP_BUCKET)
  if (!bucket) {
    const { error: bucketError } = await admin.storage.createBucket(BACKUP_BUCKET, { public: false })
    if (bucketError && !/already exists/i.test(bucketError.message)) return json(500, { error: "backup_bucket_failed" })
  }

  const results: Record<string, unknown>[] = []
  for (const job of jobs) {
    const finish = (status: string, newSize: number | null, err: string | null) =>
      admin.rpc("finish_listing_image_recompress", { p_secret: input.secret, p_path: job.path, p_status: status, p_new_size: newSize, p_error: err })
    try {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${SOURCE_BUCKET}/${job.path.split("/").map(encodeURIComponent).join("/")}`
      const accept = job.mimetype === "image/jpeg" ? "image/jpeg" : "image/webp"
      const res = await fetch(`${OPTIMIZER}?url=${encodeURIComponent(publicUrl)}&w=1600&q=75`, { headers: { accept } })
      const contentType = res.headers.get("content-type") ?? ""
      if (!res.ok || !contentType.startsWith("image/")) throw new Error(`optimizer_${res.status}`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (bytes.byteLength < 2000) throw new Error("optimizer_tiny_output")
      if (bytes.byteLength > job.original_size * MAX_RATIO) {
        if (!dryRun) await finish("skipped", bytes.byteLength, "not_smaller_enough")
        results.push({ path: job.path, status: "skipped", from: job.original_size, to: bytes.byteLength })
        continue
      }
      if (dryRun) {
        await finish("pending", null, null)
        results.push({ path: job.path, status: "dry_run", from: job.original_size, to: bytes.byteLength, contentType })
        continue
      }
      const { error: copyError } = await admin.storage.from(SOURCE_BUCKET).copy(job.path, job.path, { destinationBucket: BACKUP_BUCKET })
      if (copyError && !/already exists|duplicate/i.test(copyError.message)) throw new Error(`backup_${copyError.message}`)
      const { error: uploadError } = await admin.storage.from(SOURCE_BUCKET).update(job.path, bytes, {
        contentType,
        cacheControl: "31536000",
        upsert: true,
      })
      if (uploadError) throw new Error(`upload_${uploadError.message}`)
      await finish("done", bytes.byteLength, null)
      results.push({ path: job.path, status: "done", from: job.original_size, to: bytes.byteLength })
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown"
      await finish("failed", null, message)
      results.push({ path: job.path, status: "failed", error: message })
    }
  }
  return json(200, { processed: results.length, results })
})
