// @vitest-environment node
/** Runs supabase/qa/social_media_agent_os_v1.sql in PGlite and tests the database-level invariants. */
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

let db: PGlite
const ADMIN = "11111111-1111-4111-8111-111111111111"
const USER = "22222222-2222-4222-8222-222222222222"
const SQL = readFileSync("supabase/qa/social_media_agent_os_v1.sql", "utf8") + "\n" + readFileSync("supabase/migrations/20261107010000_social_stories.sql", "utf8")

async function as<T = Record<string, unknown>>(role: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${role}`)
  try { return (await db.query<T>(sql, params)).rows } finally { await db.exec("reset role") }
}
const svc = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => as<T>("service_role", sql, params)
async function rejects(promise: Promise<unknown>, pattern: RegExp) {
  await expect(promise).rejects.toThrow(pattern)
}

async function createPost(key = "k1", platforms = "{instagram,facebook}", when = "now() - interval '1 minute'") {
  const [row] = await svc<{ id: string }>(`insert into social_posts (idempotency_key,pillar,caption,media_urls,platforms,scheduled_for,created_by_type,created_by)
    values ($1,'trust','ტესტის ტექსტი SamoSell-ისთვის','{https://samosell.ge/a.jpg}',$2::text[],${when},'agent','creative') returning id`, [key, platforms])
  return row.id
}
async function readyAndApprove(id: string, version = 1) {
  await svc("update social_posts set quality_passed=true, quality_report='{\"passed\":true}', status='ready_for_review' where id=$1", [id])
  await svc("insert into social_approvals (post_id,post_version) values ($1,$2)", [id, version])
  return svc("select public.social_decide_approval($1,$2,true,$3) as r", [id, version, ADMIN])
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles(id uuid primary key, is_admin boolean not null default false);
    insert into public.profiles values ('${ADMIN}', true), ('${USER}', false);
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on public.profiles to authenticated; grant execute on function auth.uid() to authenticated;`)
  await db.exec(SQL)
  // Supabase grants service_role full table privileges by default; mirror that here.
  // Supabase's default privileges grant ALL on new tables to service_role. Simulate that, then
  // re-apply the file so its explicit revokes are tested against the real starting point.
  await db.exec("grant all on all tables in schema public to service_role; grant usage on all sequences in schema public to service_role;")
  await db.exec(SQL)
}, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec(`alter table social_audit_log disable trigger social_audit_append_only;
    delete from social_audit_log; delete from social_publish_jobs; delete from social_approvals; delete from social_ad_drafts; delete from social_posts;
    alter table social_audit_log enable trigger social_audit_append_only;
    update social_control set kill_switch=false, execution_mode='dry_run', instagram_enabled=true, facebook_enabled=true, organic_auto_publish=false;`)
})

describe("stories migration", () => {
  it("accepts content_type 'story', still rejects unknown types, and Stories default to off", async () => {
    const [row] = await svc<{ id: string }>(`insert into social_posts (idempotency_key,pillar,content_type,caption,media_urls,platforms,scheduled_for,created_by_type,created_by)
      values ('k:story','featured_listing','story','Story · ტესტი','{https://samosell.ge/a.jpg}','{instagram,facebook}',now(),'agent','creative') returning id`)
    expect(row.id).toBeTruthy()
    await rejects(svc(`insert into social_posts (idempotency_key,pillar,content_type,caption,platforms,scheduled_for,created_by_type,created_by)
      values ('k:reel','trust','reel','x','{facebook}',now(),'agent','creative')`), /check/i)
    const [c] = await svc<{ stories_enabled: boolean }>("select stories_enabled from social_control")
    expect(c.stories_enabled).toBe(false)
  })
})

describe("paid-budget-zero and platform invariants (CHECK constraints)", () => {
  it("defaults are kill switch ON, dry-run, TikTok off, auto-publish off, $0", async () => {
    const fresh = new PGlite()
    await fresh.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$; create table public.profiles(id uuid primary key, is_admin boolean);`)
    await fresh.exec(SQL)
    const [c] = (await fresh.query<Record<string, unknown>>("select * from social_control")).rows
    expect(c).toMatchObject({ kill_switch: true, execution_mode: "dry_run", tiktok_enabled: false, organic_auto_publish: false, approval_mode: "paid", paid_ads_create_allowed: false, paid_ads_activate_allowed: false, paid_ads_spend_modify_allowed: false })
    expect(Number(c.daily_ads_budget_usd)).toBe(0)
    await fresh.close()
  })
  it("cannot set a budget, enable paid ads or TikTok — even as service_role", async () => {
    await rejects(svc("update social_control set daily_ads_budget_usd = 5"), /check constraint/)
    await rejects(svc("update social_control set paid_ads_create_allowed = true"), /check constraint/)
    await rejects(svc("update social_control set paid_ads_activate_allowed = true"), /check constraint/)
    await rejects(svc("update social_control set paid_ads_spend_modify_allowed = true"), /check constraint/)
    await rejects(svc("update social_control set tiktok_enabled = true"), /check constraint/)
    await rejects(svc("insert into social_ad_drafts (idempotency_key,title,objective,daily_budget_usd) values ('a','t','traffic',1)"), /check constraint/)
    await rejects(svc("insert into social_ad_drafts (idempotency_key,title,objective,status) values ('b','t','traffic','active')"), /check constraint/)
    await rejects(createPost("tt", "{tiktok}"), /check constraint/)
  })
  it("rejects foreign links and over-long captions", async () => {
    await rejects(svc("insert into social_posts (idempotency_key,pillar,caption,link_url,platforms,scheduled_for,created_by_type,created_by) values ('x','trust','c','https://evil.example','{facebook}',now(),'agent','a')"), /check constraint/)
    await rejects(svc(`insert into social_posts (idempotency_key,pillar,caption,platforms,scheduled_for,created_by_type,created_by) values ('y','trust',repeat('x',2201),'{facebook}',now(),'agent','a')`), /check constraint/)
  })
})

describe("approval gate and versioning", () => {
  it("enqueue requires approval of the current version; kill switch blocks", async () => {
    const id = await createPost()
    await rejects(svc("select social_enqueue_publish($1,'dry_run')", [id]), /post_not_approved/)
    await svc("update social_posts set quality_passed=true, status='ready_for_review' where id=$1", [id])
    await rejects(svc("select social_enqueue_publish($1,'dry_run')", [id]), /post_not_approved/)
    await svc("insert into social_approvals (post_id,post_version) values ($1,1)", [id])
    await svc("select social_decide_approval($1,1,true,$2)", [id, ADMIN])
    await svc("update social_control set kill_switch=true")
    await rejects(svc("select social_enqueue_publish($1,'dry_run')", [id]), /kill_switch_active/)
    await svc("update social_control set kill_switch=false")
    await rejects(svc("select social_enqueue_publish($1,'live')", [id]), /live_mode_disabled/)
    expect((await svc<{ n: number }>("select social_enqueue_publish($1,'dry_run') as n", [id]))[0].n).toBe(2)
    expect((await svc("select status from social_approvals where post_id=$1", [id]))[0].status).toBe("consumed")
  })
  it("editing content bumps version, resets QA and expires approvals; scheduled posts are locked", async () => {
    const id = await createPost()
    await readyAndApprove(id)
    await svc("update social_posts set caption = caption || ' ✏️' where id=$1", [id])
    const [p] = await svc("select version, quality_passed, status from social_posts where id=$1", [id])
    expect(p).toEqual({ version: 2, quality_passed: false, status: "draft" })
    expect((await svc("select status from social_approvals where post_id=$1", [id]))[0].status).toBe("expired")
    await rejects(svc("select social_enqueue_publish($1,'dry_run')", [id]), /post_not_approved/)
    await readyAndApprove(id, 2)
    await svc("select social_enqueue_publish($1,'dry_run')", [id])
    await rejects(svc("update social_posts set caption = 'შეცვლილი ტექსტი' where id=$1", [id]), /social_post_locked/)
  })
  it("approval decisions are version-bound and single-use", async () => {
    const id = await createPost()
    await svc("update social_posts set quality_passed=true, status='ready_for_review' where id=$1", [id])
    await svc("insert into social_approvals (post_id,post_version) values ($1,1)", [id])
    await rejects(svc("select social_decide_approval($1,2,true,$2)", [id, ADMIN]), /stale_version/)
    await rejects(svc("select social_decide_approval($1,1,true,null)", [id]), /decider_required/)
    await svc("select social_decide_approval($1,1,true,$2)", [id, ADMIN])
    await rejects(svc("select social_decide_approval($1,1,true,$2)", [id, ADMIN]), /post_not_reviewable|approval_not_pending/)
  })
  it("expired approvals cannot be used", async () => {
    const id = await createPost()
    await svc("update social_posts set quality_passed=true, status='ready_for_review' where id=$1", [id])
    await svc("insert into social_approvals (post_id,post_version,expires_at) values ($1,1,now() - interval '1 minute')", [id])
    await rejects(svc("select social_decide_approval($1,1,true,$2)", [id, ADMIN]), /approval_not_pending/)
  })
})

describe("duplicate publishing, queue, locking and retry", () => {
  it("repeated enqueue never creates duplicate jobs", async () => {
    const id = await createPost()
    await readyAndApprove(id)
    await svc("update social_control set organic_auto_publish=true") // second enqueue path without a fresh approval
    await svc("select social_enqueue_publish($1,'dry_run')", [id])
    await svc("update social_posts set status='approved' where id=$1", [id])
    expect((await svc<{ n: number }>("select social_enqueue_publish($1,'dry_run') as n", [id]))[0].n).toBe(0)
    expect((await svc<{ n: number }>("select count(*)::int as n from social_publish_jobs where post_id=$1", [id]))[0].n).toBe(2)
  })
  it("a second 'published' job for the same post/platform is impossible", async () => {
    const id = await createPost()
    await svc(`insert into social_publish_jobs (post_id,post_version,platform,execution_mode,idempotency_key,status,scheduled_at) values ($1,1,'instagram','live','a','published',now())`, [id])
    await rejects(svc(`insert into social_publish_jobs (post_id,post_version,platform,execution_mode,idempotency_key,status,scheduled_at) values ($1,1,'instagram','dry_run','b','published',now())`, [id]), /duplicate key/)
  })
  it("claim leases each job once; complete requires the lease token; post status rolls up", async () => {
    const id = await createPost()
    await readyAndApprove(id)
    await svc("select social_enqueue_publish($1,'dry_run')", [id])
    const first = await svc<{ job_id: string; lease_token: string }>("select * from social_claim_publish_jobs(5, 60)")
    expect(first).toHaveLength(2)
    expect(await svc("select * from social_claim_publish_jobs(5, 60)")).toHaveLength(0)
    expect((await svc("select social_complete_publish_job($1, gen_random_uuid(), 'x') as ok", [first[0].job_id]))[0].ok).toBe(false)
    for (const j of first) expect((await svc("select social_complete_publish_job($1,$2,'dryrun_1') as ok", [j.job_id, j.lease_token]))[0].ok).toBe(true)
    expect((await svc("select status from social_posts where id=$1", [id]))[0].status).toBe("published")
    expect((await svc("select distinct status from social_publish_jobs"))).toEqual([{ status: "dry_run_completed" }])
  })
  it("kill switch stops claiming; live jobs are not claimed in dry-run control", async () => {
    const id = await createPost()
    await svc(`insert into social_publish_jobs (post_id,post_version,platform,execution_mode,idempotency_key,scheduled_at) values ($1,1,'facebook','live','live-1',now() - interval '1 minute')`, [id])
    expect(await svc("select * from social_claim_publish_jobs(5, 60)")).toHaveLength(0)
    await svc(`insert into social_publish_jobs (post_id,post_version,platform,execution_mode,idempotency_key,scheduled_at) values ($1,1,'facebook','dry_run','dry-1',now() - interval '1 minute')`, [id])
    await svc("update social_control set kill_switch=true")
    expect(await svc("select * from social_claim_publish_jobs(5, 60)")).toHaveLength(0)
  })
  it("retry with backoff, dead-letter at max, unknown outcome → needs_review, expired lease → needs_review", async () => {
    const id = await createPost("k1", "{facebook}")
    await svc(`insert into social_publish_jobs (post_id,post_version,platform,execution_mode,idempotency_key,scheduled_at,max_attempts) values ($1,1,'facebook','dry_run','r-1',now() - interval '1 minute',2)`, [id])
    let [j] = await svc<{ job_id: string; lease_token: string }>("select * from social_claim_publish_jobs(1, 60)")
    expect((await svc("select social_fail_publish_job($1,$2,'meta_api_unavailable',true) as s", [j.job_id, j.lease_token]))[0].s).toBe("queued")
    const [{ later }] = await svc<{ later: boolean }>("select scheduled_at > now() as later from social_publish_jobs where id=$1", [j.job_id])
    expect(later).toBe(true)
    await svc("update social_publish_jobs set scheduled_at = now() - interval '1 second' where id=$1", [j.job_id]);
    [j] = await svc("select * from social_claim_publish_jobs(1, 60)")
    expect((await svc("select social_fail_publish_job($1,$2,'meta_api_unavailable',true) as s", [j.job_id, j.lease_token]))[0].s).toBe("dead_letter")

    const id2 = await createPost("k2", "{facebook}")
    await svc(`insert into social_publish_jobs (post_id,post_version,platform,execution_mode,idempotency_key,scheduled_at) values ($1,1,'facebook','live','u-1',now() - interval '1 minute')`, [id2])
    await svc("update social_control set execution_mode='live'");
    [j] = await svc("select * from social_claim_publish_jobs(1, 60)")
    expect((await svc("select social_fail_publish_job($1,$2,'unknown_outcome',true) as s", [j.job_id, j.lease_token]))[0].s).toBe("needs_review")

    const id3 = await createPost("k3", "{facebook}")
    await svc(`insert into social_publish_jobs (post_id,post_version,platform,execution_mode,idempotency_key,scheduled_at) values ($1,1,'facebook','live','l-1',now() - interval '1 minute')`, [id3]);
    [j] = await svc("select * from social_claim_publish_jobs(1, 60)")
    await svc("update social_publish_jobs set leased_until = now() - interval '1 second' where id=$1", [j.job_id])
    await svc("select * from social_claim_publish_jobs(1, 60)")
    expect((await svc("select status, last_error_code from social_publish_jobs where id=$1", [j.job_id]))[0]).toEqual({ status: "needs_review", last_error_code: "lease_expired" })
  })
  it("instagram container id can be recorded once and only by the lease holder", async () => {
    const id = await createPost("k1", "{instagram}")
    await svc(`insert into social_publish_jobs (post_id,post_version,platform,execution_mode,idempotency_key,scheduled_at) values ($1,1,'instagram','dry_run','c-1',now() - interval '1 minute')`, [id])
    const [j] = await svc<{ job_id: string; lease_token: string }>("select * from social_claim_publish_jobs(1, 60)")
    expect((await svc("select social_record_container($1, gen_random_uuid(), 'c1') as ok", [j.job_id]))[0].ok).toBe(false)
    expect((await svc("select social_record_container($1,$2,'c1') as ok", [j.job_id, j.lease_token]))[0].ok).toBe(true)
    expect((await svc("select social_record_container($1,$2,'c2') as ok", [j.job_id, j.lease_token]))[0].ok).toBe(false)
  })
})

describe("permissions (RLS, grants, append-only audit)", () => {
  async function asUser(sub: string | null, sql: string) {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false)`)
    try { return (await db.query(sql)).rows } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false)") }
  }
  it("admins can read, normal users see nothing, anon has no access", async () => {
    await createPost()
    expect(await asUser(ADMIN, "select id from social_posts")).toHaveLength(1)
    expect(await asUser(USER, "select id from social_posts")).toHaveLength(0)
    expect(await asUser(USER, "select * from social_control")).toHaveLength(0)
    await rejects(as("anon", "select id from social_posts"), /permission denied/)
  })
  it("authenticated users (even admins) cannot write or call RPCs from the browser", async () => {
    await rejects(asUser(ADMIN, "update social_control set kill_switch=false"), /permission denied/)
    await rejects(asUser(ADMIN, "insert into social_audit_log (actor_type,actor,action,decision,reason,resource_type) values ('human','x','y','allow','z','w')"), /permission denied/)
    await rejects(asUser(ADMIN, "select * from social_claim_publish_jobs(1,60)"), /permission denied/)
    await rejects(asUser(ADMIN, "select social_enqueue_publish(gen_random_uuid(),'dry_run')"), /permission denied/)
    await rejects(asUser(ADMIN, "select social_decide_approval(gen_random_uuid(),1,true,gen_random_uuid())"), /permission denied/)
    await rejects(as("anon", "select social_enqueue_publish(gen_random_uuid(),'dry_run')"), /permission denied/)
  })
  it("audit log is append-only even for service_role", async () => {
    await svc("insert into social_audit_log (actor_type,actor,action,decision,reason,resource_type) values ('system','t','kill_switch_on','success','ok','control')")
    await rejects(svc("update social_audit_log set reason='changed'"), /permission denied|social_audit_log_append_only/)
    await rejects(db.query("update social_audit_log set reason='changed'"), /social_audit_log_append_only/) // trigger holds even for the owner
    await rejects(svc("delete from social_audit_log"), /permission denied|social_audit_log_append_only/)
    await rejects(svc("insert into social_audit_log (actor_type,actor,action,decision,reason,resource_type) values ('system','t','x','allow','has spaces','control')"), /check constraint/)
    await rejects(svc("truncate social_audit_log"), /permission denied/)
    await rejects(svc("delete from social_control"), /permission denied/)
  })
})
