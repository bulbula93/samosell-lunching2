import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20261012110000_listing_view_daily.sql", "utf8")
const listingId = "43ddc03a-73b6-4d11-993d-046640413655"
const inactiveId = "872c4d33-facb-4f1c-9755-24f9a3f38c92"
let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.listings (
      id uuid primary key,
      seller_id uuid not null,
      status text not null,
      views_count integer not null default 0
    );
    insert into public.listings (id,seller_id,status)
    values
      ('${listingId}', '99da275c-d3ab-4b57-95f2-3e1e9d17cf94', 'active'),
      ('${inactiveId}', '99da275c-d3ab-4b57-95f2-3e1e9d17cf94', 'draft');
  `)
  await db.exec(migration)
}, 30000)

afterAll(async () => {
  await db?.close()
})

describe("Listing view daily migration", () => {
  it("counts only the first view of the day and a new viewer", async () => {
    const digestOne = "a".repeat(64)
    const digestTwo = "b".repeat(64)
    const first = await db.query<{ counted: boolean }>(
      "select public.record_distinct_listing_view($1,$2) as counted", [listingId,digestOne],
    )
    const duplicate = await db.query<{ counted: boolean }>(
      "select public.record_distinct_listing_view($1,$2) as counted", [listingId,digestOne],
    )
    const second = await db.query<{ counted: boolean }>(
      "select public.record_distinct_listing_view($1,$2) as counted", [listingId,digestTwo],
    )
    expect(first.rows[0]?.counted).toBe(true)
    expect(duplicate.rows[0]?.counted).toBe(false)
    expect(second.rows[0]?.counted).toBe(true)
    const result = await db.query<{ views_count: number }>("select views_count from public.listings where id=$1", [listingId])
    expect(result.rows[0]?.views_count).toBe(2)
  })

  it("rejects invalid hashes and inactive listings", async () => {
    const invalidHash = await db.query<{ counted: boolean }>(
      "select public.record_distinct_listing_view($1,$2) as counted", [listingId,"not-a-hash"],
    )
    const inactive = await db.query<{ counted: boolean }>(
      "select public.record_distinct_listing_view($1,$2) as counted", [inactiveId,"c".repeat(64)],
    )
    expect(invalidHash.rows[0]?.counted).toBe(false)
    expect(inactive.rows[0]?.counted).toBe(false)
  })
})
