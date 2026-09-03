import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260902105632_add_global_ad_system.sql"),
  "utf8",
).toLowerCase()

describe("global ad system migration", () => {
  it("creates scheduled ad inventory with a useful active-placement index", () => {
    expect(migration).toContain("create table public.ads")
    expect(migration).toContain("ads_active_placement_priority_idx")
    expect(migration).toContain("where is_active")
    expect(migration).toContain("starts_at is null or starts_at <= now()")
    expect(migration).toContain("ends_at is null or ends_at >= now()")
  })

  it("enables RLS and exposes only read access to active ad inventory", () => {
    expect(migration).toContain("alter table public.ads enable row level security")
    expect(migration).toContain('create policy "public can read currently active ads"')
    expect(migration).toContain("grant select on table public.ads to anon, authenticated")
    expect(migration).not.toContain("grant insert on table public.ads to anon")
  })

  it("keeps deduplicated tracking events server-only", () => {
    expect(migration).toContain("create table public.ad_events")
    expect(migration).toContain("dedupe_key text not null unique")
    expect(migration).toContain("alter table public.ad_events enable row level security")
    expect(migration).toContain("revoke all on table public.ad_events from public, anon, authenticated")
  })
})
