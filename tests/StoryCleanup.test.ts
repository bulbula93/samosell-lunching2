// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
vi.mock("server-only", () => ({}))
import { cleanupAuthorized, runStoryCleanup, validateCleanupProject, STORY_PRODUCTION_REF } from "@/lib/story-cleanup"
import { POST } from "@/app/api/internal/story-cleanup/route"

let db: PGlite
const id = "11111111-1111-4111-8111-111111111111"
const path = `${id}/${id}/${id}.jpg`
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema storage;
    create table storage.objects(bucket_id text,name text,created_at timestamptz);
    create table stories(id uuid,media_path text,expires_at timestamptz,deleted_at timestamptz);
    create table story_upload_plans(story_id uuid,media_path text,expires_at timestamptz,published_at timestamptz,revoked_at timestamptz);`)
  await db.exec(readFileSync("supabase/migrations/20260911064423_harden_story_cleanup_retention.sql", "utf8"))
}, 30000)
afterAll(async () => db.close())
beforeEach(async () => { vi.unstubAllEnvs(); await db.exec("truncate storage.objects,stories,story_upload_plans") })
async function object(age = "3 hours", name = path) {
  await db.query("insert into storage.objects values('story-media',$1,now()-$2::interval)", [name,age])
}
async function candidates(limit = 100) { return (await db.query("select * from list_expired_story_media_for_cleanup($1)", [limit])).rows }

it("rejects missing, wrong or unconfigured invocation credentials before DB access", async () => {
  expect(cleanupAuthorized(null, undefined)).toBe(false)
  expect(cleanupAuthorized("Bearer undefined", undefined)).toBe(false)
  expect(cleanupAuthorized("Bearer wrong", "x".repeat(32))).toBe(false)
  expect(cleanupAuthorized(`Bearer ${"x".repeat(32)}`, "x".repeat(32))).toBe(true)
  expect((await POST(new Request("https://example.com/api/internal/story-cleanup", { method:"POST" }))).status).toBe(401)
})
it("remains disabled even with valid credentials until explicitly activated", async () => {
  vi.stubEnv("STORY_CLEANUP_SECRET", "x".repeat(32))
  expect((await POST(new Request("https://example.com", {method:"POST",headers:{authorization:`Bearer ${"x".repeat(32)}`}}))).status).toBe(503)
})
it("rejects wrong refs, lookalike hosts, HTTP and URL credentials", () => {
  for (const url of ["https://other.supabase.co", `https://${STORY_PRODUCTION_REF}.supabase.co.evil.test`, `http://${STORY_PRODUCTION_REF}.supabase.co`, `https://user@${STORY_PRODUCTION_REF}.supabase.co`]) expect(() => validateCleanupProject(url, STORY_PRODUCTION_REF)).toThrow()
  expect(() => validateCleanupProject(`https://${STORY_PRODUCTION_REF}.supabase.co`, "other")).toThrow()
  expect(() => validateCleanupProject(`https://${STORY_PRODUCTION_REF}.supabase.co`, STORY_PRODUCTION_REF)).not.toThrow()
})
it("denies cleanup and pruning RPCs to browser roles", async () => {
  for (const role of ["anon","authenticated"]) {
    await db.exec(`set role ${role}`)
    await expect(db.query("select * from list_expired_story_media_for_cleanup()")).rejects.toThrow(/permission denied/)
    await expect(db.query("select prune_unpublished_story_upload_plans()")).rejects.toThrow(/permission denied/)
    await db.exec("reset role")
  }
})
it("never selects active or recently expired/deleted Story media", async () => {
  await object("10 days")
  for (const expiry of ["1 hour", "-1 day", "-6 days"]) {
    await db.query("insert into stories values($1,$2,now()+$3::interval,null)", [id,path,expiry])
    expect(await candidates()).toHaveLength(0)
    await db.exec("truncate stories")
  }
  await db.query("insert into stories values($1,$2,now()-interval '10 days',now()-interval '1 day')",[id,path])
  expect(await candidates()).toHaveLength(0)
})
it("selects expired media only after seven days and abandoned objects only after two hours", async () => {
  await object("1 hour"); expect(await candidates()).toHaveLength(0)
  await db.exec("truncate storage.objects"); await object(); expect(await candidates()).toHaveLength(1)
  await db.query("insert into stories values($1,$2,now()-interval '8 days',null)",[id,path])
  expect(await candidates()).toHaveLength(1)
})
it("excludes objects with a still-live upload authorization", async () => {
  await object()
  await db.query("insert into story_upload_plans values($1,$2,now()+interval '1 minute',null,null)",[id,path])
  expect(await candidates()).toHaveLength(0)
})
it("bounds candidates even when caller requests an excessive limit", async () => {
  await db.exec(`insert into storage.objects select 'story-media','${id}/${id}/'||gen_random_uuid()||'.jpg',now()-interval '3 hours' from generate_series(1,505)`)
  expect(await candidates(100000)).toHaveLength(500)
  expect(await candidates(3)).toHaveLength(3)
})
it("prunes old unpublished plans only after objects are gone, preserving published or referenced evidence", async () => {
  await db.query("insert into story_upload_plans values($1,$2,now()-interval '2 days',null,null)",[id,path])
  await object()
  expect((await db.query("select prune_unpublished_story_upload_plans() n")).rows).toEqual([{n:0}])
  await db.exec("truncate storage.objects; update story_upload_plans set published_at=now()")
  expect((await db.query("select prune_unpublished_story_upload_plans() n")).rows).toEqual([{n:0}])
  await db.exec("update story_upload_plans set published_at=null")
  await db.query("insert into stories values($1,$2,now(),null)",[id,path])
  expect((await db.query("select prune_unpublished_story_upload_plans() n")).rows).toEqual([{n:0}])
  await db.exec("truncate stories")
  expect((await db.query("select prune_unpublished_story_upload_plans() n")).rows).toEqual([{n:1}])
})
it("bounds pruning and leaves recent unpublished plans", async () => {
  await db.exec("insert into story_upload_plans select gen_random_uuid(),gen_random_uuid()::text,now()-interval '2 days',null,null from generate_series(1,10)")
  expect((await db.query("select prune_unpublished_story_upload_plans(3) n")).rows).toEqual([{n:3}])
  await db.exec("update story_upload_plans set expires_at=now()")
  expect((await db.query("select prune_unpublished_story_upload_plans() n")).rows).toEqual([{n:0}])
})
it("rejects user path injection and unrelated buckets", async () => {
  await object("3 hours", `${id}/../../listing-media/*`)
  expect(await candidates()).toHaveLength(0)
  await object(); await db.exec("update storage.objects set bucket_id='listing-media'")
  expect(await candidates()).toHaveLength(0)
})
it("keeps failed Storage removals retryable and never prunes on removal failure", async () => {
  const remove = vi.fn().mockResolvedValueOnce({error:{}}).mockResolvedValue({error:null})
  const rpc = vi.fn().mockImplementation(async (name) => ({data:name.startsWith('list_') ? [{media_path:path}] : 1,error:null}))
  const client = {rpc,storage:{from:vi.fn().mockReturnValue({remove})}} as unknown as SupabaseClient
  await expect(runStoryCleanup(client)).rejects.toThrow("cleanup_storage_failed")
  expect(rpc).toHaveBeenCalledTimes(1)
  await expect(runStoryCleanup(client)).resolves.toMatchObject({selected:1,pruned:1})
  expect(remove).toHaveBeenNthCalledWith(2,[path])
})
it("rejects malformed or oversized candidate responses before any deletion", async () => {
  const remove=vi.fn()
  for (const data of [[{media_path:'../*'}],Array.from({length:101},()=>({media_path:path}))]) {
    const client={rpc:vi.fn().mockResolvedValue({data,error:null}),storage:{from:()=>({remove})}} as unknown as SupabaseClient
    await expect(runStoryCleanup(client)).rejects.toThrow()
  }
  expect(remove).not.toHaveBeenCalled()
})
