// In-memory PostgreSQL only. No connection to any Supabase project.
import { PGlite } from "@electric-sql/pglite"
import { readFileSync, readdirSync } from "node:fs"
import { expect, it } from "vitest"

it("preserves anonymous public and authenticated public-or-owner visibility when policies are consolidated", async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.user_id', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      create table public.ads (id int primary key, submitted_by uuid, is_active boolean, starts_at timestamptz, ends_at timestamptz);
      alter table public.ads enable row level security;
      grant select on public.ads to anon, authenticated;
      create policy "public can read currently active ads" on public.ads for select to anon, authenticated
        using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()));
      create policy "users can read own submitted ads" on public.ads for select to authenticated
        using (submitted_by = (select auth.uid()));
      insert into public.ads values
        (1, '11111111-1111-1111-1111-111111111111', true, null, null),
        (2, '11111111-1111-1111-1111-111111111111', false, null, null),
        (3, '22222222-2222-2222-2222-222222222222', false, null, null),
        (4, '22222222-2222-2222-2222-222222222222', true, now()+interval '1 day', null),
        (5, '22222222-2222-2222-2222-222222222222', true, null, now()-interval '1 day'),
        (6, null, true, now()-interval '1 day', now()+interval '1 day');
    `)
    const identities = [
      { role: "anon", uid: "", expected: [1, 6] },
      { role: "authenticated", uid: "11111111-1111-1111-1111-111111111111", expected: [1, 2, 6] },
      { role: "authenticated", uid: "22222222-2222-2222-2222-222222222222", expected: [1, 3, 4, 5, 6] },
      { role: "authenticated", uid: "", expected: [1, 6] },
    ]
    async function visible(role: string, uid: string) {
      await db.exec(`set role ${role}; set request.user_id = '${uid}';`)
      const result = await db.query<{ id: number }>("select id from ads order by id")
      await db.exec("reset role;")
      return result.rows.map((r) => r.id)
    }
    for (const identity of identities) expect(await visible(identity.role, identity.uid)).toEqual(identity.expected)
    const root = "supabase/proposals/io-optimization-20261006"
    const sql = readFileSync(`${root}/${readdirSync(root).find((file) => file.includes("supabase_io_optimization_proposals"))}`, "utf8")
    await db.exec(sql)
    for (const identity of identities) expect(await visible(identity.role, identity.uid)).toEqual(identity.expected)
    const policies = await db.query<{ roles: string[] }>("select roles from pg_policies where tablename='ads'")
    expect(policies.rows).toHaveLength(2)
    expect(policies.rows.filter((r) => r.roles.includes("authenticated"))).toHaveLength(1)
  } finally { await db.close() }
}, 20_000)
