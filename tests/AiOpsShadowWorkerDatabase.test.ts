// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
let db: PGlite;
async function asRole(sql: string, role = "ai_ops_shadow_engine") {
  await db.exec(`set session authorization ${role}`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("set session authorization postgres; reset role");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key); create table profiles(id uuid primary key,is_admin boolean);
    create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
    grant usage on schema public,auth to authenticated;grant select on profiles to authenticated;`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261017170000_ai_ops_foundation.sql",
      "utf8",
    ),
  );
  await db.exec(readFileSync("supabase/qa/ai_ops_reader.sql", "utf8"));
  // Match a real migration transaction for SET LOCAL ROLE ownership.
  await db.exec(
    "begin;" +
      readFileSync("supabase/qa/ai_ops_shadow_worker.sql", "utf8") +
      ";commit;",
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "delete from ai_ops_activity;delete from ai_ops_jobs;update ai_ops_control set stopped=false,worker_enabled=true,scheduler_enabled=true,last_tick_at=null,last_tick_status=null;",
  );
});
async function enqueue() {
  return await asRole("select ai_ops_private.enqueue_observation() as n");
}
async function claim() {
  return (await asRole("select * from ai_ops_private.claim_observation()"))
    .rows[0] as { job_id: string; token: string } | undefined;
}

describe("QA shadow worker transactions", () => {
  it("defaults stopped and requires worker and scheduler enablement", async () => {
    await db.exec("update ai_ops_control set stopped=true");
    expect(
      (
        await asRole(
          "select ai_ops_private.run_shadow_tick() as result",
          "ai_ops_shadow_caller",
        )
      ).rows,
    ).toEqual([{ result: { state: "stopped" } }]);
    expect(
      (await db.query("select count(*)::int as n from ai_ops_jobs")).rows,
    ).toEqual([{ n: 0 }]);
    await db.exec(
      "update ai_ops_control set stopped=false,worker_enabled=false",
    );
    expect(
      (
        await asRole(
          "select ai_ops_private.run_shadow_tick() as result",
          "ai_ops_shadow_caller",
        )
      ).rows,
    ).toEqual([{ result: { state: "stopped" } }]);
    await db.exec(
      "update ai_ops_control set worker_enabled=true,scheduler_enabled=false",
    );
    expect(
      (
        await asRole(
          "select ai_ops_private.run_shadow_tick() as result",
          "ai_ops_shadow_caller",
        )
      ).rows,
    ).toEqual([{ result: { state: "scheduler_disabled" } }]);
  });
  it("deduplicates one technical observation per time bucket", async () => {
    expect((await enqueue()).rows).toEqual([{ n: 1 }]);
    expect((await enqueue()).rows).toEqual([{ n: 0 }]);
    expect(
      (
        await db.query(
          "select count(*)::int as n from ai_ops_activity where event_type='queued'",
        )
      ).rows,
    ).toEqual([{ n: 1 }]);
  });
  it("claims once, rejects stale tokens and prevents duplicate completions", async () => {
    await enqueue();
    const j = (await claim())!;
    expect(j.job_id).toBeTruthy();
    expect(await claim()).toBeUndefined();
    expect(
      (
        await asRole(
          `select ai_ops_private.finish_observation('${j.job_id}',gen_random_uuid()) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
    expect(
      (
        await asRole(
          `select ai_ops_private.finish_observation('${j.job_id}','${j.token}') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asRole(
          `select ai_ops_private.finish_observation('${j.job_id}','${j.token}') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
    expect(
      (
        await db.query(
          "select count(*)::int as n from ai_ops_activity where event_type='completed'",
        )
      ).rows,
    ).toEqual([{ n: 1 }]);
  });
  it("stops before execution after a claim and does not complete expired leases", async () => {
    await enqueue();
    const j = (await claim())!;
    await db.exec("update ai_ops_control set stopped=true");
    expect(
      (
        await asRole(
          `select ai_ops_private.finish_observation('${j.job_id}','${j.token}') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
    await db.exec(
      "update ai_ops_control set stopped=false;update ai_ops_jobs set leased_until=now()-interval '1 second'",
    );
    expect(
      (
        await asRole(
          `select ai_ops_private.finish_observation('${j.job_id}','${j.token}') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
  });
  it("recovers expired leases with backoff and dead-letters exhausted retries", async () => {
    await enqueue();
    await claim();
    await db.exec(
      "update ai_ops_jobs set leased_until=now()-interval '1 second'",
    );
    expect(
      (await asRole("select ai_ops_private.recover_observations() as n")).rows,
    ).toEqual([{ n: 1 }]);
    expect(await claim()).toBeUndefined();
    await db.exec(
      "update ai_ops_jobs set scheduled_at=now()-interval '1 second',attempt=2",
    );
    const j = (await claim())!;
    expect(j).toBeTruthy();
    await db.exec(
      "update ai_ops_jobs set leased_until=now()-interval '1 second'",
    );
    await asRole("select ai_ops_private.recover_observations()");
    expect(
      (await db.query("select status,attempt from ai_ops_jobs")).rows,
    ).toEqual([{ status: "dead_letter", attempt: 3 }]);
    expect(await claim()).toBeUndefined();
  });
  it("redacts errors to an enum and retries failures only within the budget", async () => {
    await enqueue();
    const j = (await claim())!;
    await expect(
      asRole(
        `select ai_ops_private.fail_observation('${j.job_id}','${j.token}','raw customer text')`,
      ),
    ).rejects.toThrow("invalid_failure_code");
    expect(
      (
        await asRole(
          `select ai_ops_private.fail_observation('${j.job_id}','${j.token}','execution_failed') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (await db.query("select status,attempt,lease_token from ai_ops_jobs"))
        .rows,
    ).toEqual([{ status: "queued", attempt: 1, lease_token: null }]);
  });
  it("executes an audited bounded tick without creating approvals or touching customer data", async () => {
    const result = (
      await asRole(
        "select ai_ops_private.run_shadow_tick() as result",
        "ai_ops_shadow_caller",
      )
    ).rows[0] as { result: { completed: number; enqueued: number } };
    expect(result.result).toMatchObject({ completed: 1, enqueued: 1 });
    expect(
      (
        await db.query<{ event_type: string }>(
          "select event_type from ai_ops_activity order by sequence",
        )
      ).rows
        .map((r) => r.event_type),
    ).toEqual(["queued", "claimed", "completed"]);
    expect(
      (await db.query("select count(*)::int as n from ai_ops_approvals")).rows,
    ).toEqual([{ n: 0 }]);
  });
  it("keeps caller, reader and anonymous users outside the privileged helpers", async () => {
    for (const role of [
      "anon",
      "authenticated",
      "ai_ops_qa_reader",
      "service_role",
    ]) {
      await expect(
        asRole("select ai_ops_private.run_shadow_tick()", role),
      ).rejects.toThrow(/permission denied/);
    }
    await expect(
      asRole(
        "select ai_ops_private.claim_observation()",
        "ai_ops_shadow_caller",
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole("update ai_ops_control set stopped=false"),
    ).rejects.toThrow(/permission denied/);
    await expect(asRole("select * from profiles")).rejects.toThrow(
      /permission denied/,
    );
    await expect(asRole("set role service_role")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      asRole(
        "insert into ai_ops_jobs(idempotency_key,role,kind) values('bad','support','shadow_support')",
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
