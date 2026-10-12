// @vitest-environment node
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
      "select public.record_distinct_listing_view($1,$2,$3) as counted", [listingId,digestOne,"d".repeat(64)],
    )
    const duplicate = await db.query<{ counted: boolean }>(
      "select public.record_distinct_listing_view($1,$2,$3) as counted", [listingId,digestOne,"d".repeat(64)],
    )
    const second = await db.query<{ counted: boolean }>(
      "select public.record_distinct_listing_view($1,$2,$3) as counted", [listingId,digestTwo,"d".repeat(64)],
    )
    expect(first.rows[0]?.counted).toBe(true)
    expect(duplicate.rows[0]?.counted).toBe(false)
    expect(second.rows[0]?.counted).toBe(true)
    const result = await db.query<{ views_count: number }>("select views_count from public.listings where id=$1", [listingId])
    expect(result.rows[0]?.views_count).toBe(2)
  })

  it("rejects invalid hashes and inactive listings", async () => {
    const invalidHash = await db.query<{ counted: boolean }>(
      "select public.record_distinct_listing_view($1,$2,$3) as counted", [listingId,"not-a-hash","d".repeat(64)],
    )
    const inactive = await db.query<{ counted: boolean }>(
      "select public.record_distinct_listing_view($1,$2,$3) as counted", [inactiveId,"c".repeat(64),"d".repeat(64)],
    )
    expect(invalidHash.rows[0]?.counted).toBe(false)
    expect(inactive.rows[0]?.counted).toBe(false)
  })

  it("enforces an atomic per-network per-listing daily cap even if browsers reset cookies", async () => {
    const source = "f".repeat(64)
    let counted = 0
    // One network creates many different signed cookie identifiers for the same listing.
    for (let index = 0; index < 40; index++) {
      const digest = index.toString(16).padStart(64, "0")
      const result = await db.query<{ counted: boolean }>(
        "select public.record_distinct_listing_view($1,$2,$3) as counted",
        [listingId,digest,source],
      )
      if (result.rows[0]?.counted) counted++
    }
    expect(counted).toBe(30)
    const n = await db.query<{ hits: number }>(
      "select hits from public.listing_view_rate_windows where scope='listing_day' and rate_key=$1",
      [source + ":" + listingId],
    )
    expect(n.rows[0]?.hits).toBe(40)
  })

  it("limits high-frequency request bursts across different listings", async () => {
    const source = "e".repeat(64)
    let rejected = 0
    for (let i = 0; i < 65; i++) {
      const anotherListing = `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`
      await db.query(
        "insert into public.listings(id,seller_id,status) values ($1,$2,'active')",
        [anotherListing,"99da275c-d3ab-4b57-95f2-3e1e9d17cf94"],
      )
      const result = await db.query<{ counted: boolean }>(
        "select public.record_distinct_listing_view($1,$2,$3) as counted",
        [anotherListing,"b".repeat(64),source],
      )
      if (!result.rows[0]?.counted) rejected++
    }
    expect(rejected).toBe(5)
    const n = await db.query<{ hits: number }>(
      "select hits from public.listing_view_rate_windows where scope='minute' and rate_key=$1",
      [source],
    )
    expect(n.rows[0]?.hits).toBe(65)
  })

  it("keeps direct browser role RPC access closed", async () => {
    const response = await db.query<{ anon: boolean; authenticated: boolean; service: boolean }>(`
      select
        has_function_privilege('anon','public.record_distinct_listing_view(uuid,text,text)','EXECUTE') as anon,
        has_function_privilege('authenticated','public.record_distinct_listing_view(uuid,text,text)','EXECUTE') as authenticated,
        has_function_privilege('service_role','public.record_distinct_listing_view(uuid,text,text)','EXECUTE') as service
    `)
    expect(response.rows[0]).toEqual({ anon: false, authenticated: false, service: true })
  })

})
