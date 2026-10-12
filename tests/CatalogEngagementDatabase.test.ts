// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20261012130000_catalog_engagement.sql","utf8")
const listingId = "221ecdc0-476a-4ff2-a826-75b259e67ea8"
const inactive = "c98471a3-9307-47f0-8b83-45000dd4fb95"
const hash = (c:string) => c.repeat(64)
let db: PGlite

const event = (id:string,kind:string,position=1) => ({
  event_key:hash(id),listing_id:listingId,event_kind:kind,position,
})
const record = async (events:unknown[],page=hash("a"),network=hash("b")) => {
  const r = await db.query<{ n:number }>(
    "select public.record_catalog_engagement($1::jsonb,$2,$3) as n",
    [JSON.stringify(events),page,network],
  )
  return r.rows[0]?.n
}

beforeAll(async () => {
  db=new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.listings(
      id uuid primary key, seller_id uuid not null,
      status text not null, views_count integer not null default 0
    );
    insert into public.listings values
      ('${listingId}','11111111-1111-4111-8111-111111111111','active',0),
      ('${inactive}','11111111-1111-4111-8111-111111111111','draft',0);
  `)
  await db.exec(migration)
},30000)
afterAll(async () => { await db?.close() })

describe("Catalog exposure and click SQL ingestion",() => {
  it("records once per kind per server-generated event key",async () => {
    expect(await record([event("c","impression")])).toBe(1)
    expect(await record([event("c","impression")])).toBe(0)
    expect(await record([event("d","click")])).toBe(1)
    const r=await db.query<{ event_kind:string,n:number }>(
      "select event_kind,count(*)::integer as n from public.catalog_engagement_events group by event_kind order by event_kind",
    )
    expect(r.rows).toEqual([
      {event_kind:"click",n:1},
      {event_kind:"impression",n:1},
    ])
  })

  it("rejects invalid, inactive, missing and excessive event batches", async () => {
    expect(await record([])).toBe(0)
    expect(await record(Array.from({length:21},()=>event("e","impression")))).toBe(0)
    expect(await record([event("e","spoofed")])).toBe(0)
    expect(await record([{...event("e","impression"),listing_id:inactive}])).toBe(0)
    expect(await record([{...event("e","impression"),listing_id:"not-uuid"}])).toBe(0)
  })

  it("limits ingested events atomically across changing page IDs", async () => {
    const source=hash("f")
    // 12 batches * 20 = 240 events; then one more batch must be declined.
    // One unique event per distinct page ID and listing, to bypass event idempotency.
    let total=0
    for(let k=0;k<12;k++){
      const items=Array.from({length:20},(_,i)=>({
        event_key:(k*20+i).toString(16).padStart(64,"0"),
        listing_id:listingId,event_kind:"impression",position:i+1,
      }))
      total+=await record(items,hash("a"),source)??0
    }
    expect(total).toBe(240)
    expect(await record([event("9","click")],hash("a"),source)).toBe(0)
  })

  it("requires service role and disallows browser table access", async () => {
    const result=await db.query<{ anon:boolean; authenticated:boolean; service:boolean }>(`
      select
        has_function_privilege('anon','public.record_catalog_engagement(jsonb,text,text)','EXECUTE') as anon,
        has_function_privilege('authenticated','public.record_catalog_engagement(jsonb,text,text)','EXECUTE') as authenticated,
        has_function_privilege('service_role','public.record_catalog_engagement(jsonb,text,text)','EXECUTE') as service
    `)
    expect(result.rows[0]).toEqual({anon:false,authenticated:false,service:true})
  })
})
