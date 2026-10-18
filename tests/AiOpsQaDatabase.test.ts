// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
let db: PGlite;
const admin = "11111111-1111-4111-8111-111111111111";
async function asRole(sql: string, role: string, uid = "") {
  await db.exec(
    `set session authorization ${role}; select set_config('request.jwt.claim.sub','${uid}',false)`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("set session authorization postgres; reset role");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
    create table auth.users(id uuid primary key); create table public.profiles(id uuid primary key,is_admin boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to authenticated; grant select on profiles to authenticated;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    insert into profiles values('${admin}',true);`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261017170000_ai_ops_foundation.sql",
      "utf8",
    ),
  );
  await db.exec(readFileSync("supabase/qa/ai_ops_reader.sql", "utf8"));
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("QA database privileges and RLS", () => {
  it("reads control with the reader and admin, hides it from a non-admin", async () => {
    expect(
      (await asRole("select stopped from ai_ops_control", "ai_ops_qa_reader"))
        .rows,
    ).toEqual([{ stopped: true }]);
    expect(
      (
        await asRole(
          "select stopped from ai_ops_control",
          "authenticated",
          admin,
        )
      ).rows,
    ).toEqual([{ stopped: true }]);
    expect(
      (await asRole("select stopped from ai_ops_control", "authenticated"))
        .rows,
    ).toEqual([]);
    await expect(
      asRole("select stopped from ai_ops_control", "anon"),
    ).rejects.toThrow(/permission denied/);
  });
  it("denies all mutations including TRUNCATE for authenticated and reader roles", async () => {
    for (const role of ["authenticated", "ai_ops_qa_reader"]) {
      for (const table of [
        "ai_ops_jobs",
        "ai_ops_activity",
        "ai_ops_approvals",
        "ai_ops_control",
      ]) {
        await expect(
          asRole(`truncate ${table} cascade`, role, admin),
        ).rejects.toThrow(/permission denied/);
        await expect(
          asRole(`delete from ${table}`, role, admin),
        ).rejects.toThrow(/permission denied/);
      }
      await expect(
        asRole("update ai_ops_control set stopped=false", role, admin),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asRole(
          "insert into ai_ops_jobs(idempotency_key,role,kind) values('test','qa','shadow_technical')",
          role,
          admin,
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });
  it("denies private columns, profiles, and escalation", async () => {
    // The triage reader can inspect state-change time without access to payloads.
    await expect(asRole("select updated_at from ai_ops_jobs", "ai_ops_qa_reader")).resolves.toBeDefined();
    await expect(
      asRole("select details from ai_ops_activity", "ai_ops_qa_reader"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole("select reviewed_by from ai_ops_approvals", "ai_ops_qa_reader"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole("select * from profiles", "ai_ops_qa_reader"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole("set role service_role", "ai_ops_qa_reader"),
    ).rejects.toThrow(/permission denied/);
  });
  it("enforces unique job attempts at the database boundary", async () => {
    await db.exec(
      "insert into ai_ops_jobs(idempotency_key,role,kind) values('qa:v05:test','qa','shadow_technical')",
    );
    await expect(
      db.exec(
        "insert into ai_ops_jobs(idempotency_key,role,kind) values('qa:v05:test','qa','shadow_technical')",
      ),
    ).rejects.toThrow(/unique/);
    expect(
      (
        await db.query(
          "select count(*)::int as count from ai_ops_jobs where idempotency_key='qa:v05:test'",
        )
      ).rows,
    ).toEqual([{ count: 1 }]);
  });
});
