// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const store=vi.hoisted(()=>({
  rpc:vi.fn(),
  owner:null as string|null,
  user:null as string|null,
  status:"active",
}))
vi.mock("@/lib/supabase/server",()=>({
  createClient: async()=>({
    from:()=>({
      select:()=>({
        in:async(_:string, ids:string[])=>({
          data:ids.map(id=>({id,seller_id:store.owner??"f6e012ed-6e48-4f12-a880-6bc69ad3202b",status:store.status})),
          error:null,
        }),
      }),
    }),
    auth:{getUser:async()=>({data:{user:store.user?{id:store.user}:null},error:null})},
  }),
}))
vi.mock("@/lib/supabase/admin",()=>({
  createAdminClient:()=>({rpc:store.rpc}),
}))

import {POST} from "@/app/api/catalog-engagement/route"

const origin="https://samosell.ge"
const listingId="2b5372e9-8128-4c5e-ab8b-a709df426459"
const pageId="930fa6f9-f7b9-4384-84b9-aed8d590ee3e"
const consent=encodeURIComponent(JSON.stringify({
  version:1,personalization:false,analytics:true,updatedAt:Date.now(),
}))
const payload={
  pageId,
  events:[
    {listingId,kind:"impression",position:1},
    {listingId,kind:"click",position:1},
  ],
}
function request({
  allow=true, from=origin, agent="Mozilla/5.0 (Macintosh; Intel Mac OS X)",
  ip="203.0.113.7", body=payload,
}: {allow?:boolean,from?:string,agent?:string,ip?:string,body?:unknown}={}) {
  return new Request(origin+"/api/catalog-engagement",{
    method:"POST",
    headers:{
      origin:from,"sec-fetch-site":"same-origin",
      "user-agent":agent,
      "content-type":"application/json",
      "x-vercel-forwarded-for":ip,
      ...(allow?{cookie:`samosell_browser_consent=${consent}`}:{}),
    },
    body:JSON.stringify(body),
  })
}
beforeEach(()=>{
  vi.unstubAllEnvs()
  vi.stubEnv("VERCEL_ENV","production")
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","local-only-service-role-secret")
  store.owner=null;store.user=null;store.status="active"
  store.rpc.mockReset().mockImplementation(async(_:string,args:{p_items:unknown[]})=>({
    data:args.p_items.length,error:null,
  }))
})
afterEach(()=>vi.unstubAllEnvs())

describe("Catalog engagement server route",()=>{
  it("records only consented validated impressions and card clicks",async()=>{
    const result=await POST(request())
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({counted:2})
    expect(store.rpc).toHaveBeenCalledTimes(1)
    const [fn,args]=store.rpc.mock.calls[0]
    expect(fn).toBe("record_catalog_engagement")
    expect(args.p_items).toHaveLength(2)
    expect(args.p_items[0]).toMatchObject({listing_id:listingId,event_kind:"impression",position:1})
    expect(args.p_items[1]).toMatchObject({listing_id:listingId,event_kind:"click",position:1})
    expect(args.p_network_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(args.p_items[0].event_key).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(args)).not.toContain("203.0.113.7")
  })
  it("rejects absent consent, foreign origins, bots and preview",async()=>{
    expect((await POST(request({allow:false}))).status).toBe(200)
    expect((await POST(request({from:"https://evil.example"}))).status).toBe(403)
    expect((await POST(request({agent:"Googlebot"}))).status).toBe(200)
    vi.stubEnv("VERCEL_ENV","preview")
    expect((await POST(request())).status).toBe(403)
    expect(store.rpc).not.toHaveBeenCalled()
  })
  it("excludes owner's own cards and inactive cards",async()=>{
    store.user="f6e012ed-6e48-4f12-a880-6bc69ad3202b"
    expect(await (await POST(request())).json()).toEqual({counted:0})
    store.user=null;store.status="draft"
    expect(await (await POST(request())).json()).toEqual({counted:0})
    expect(store.rpc).not.toHaveBeenCalled()
  })
  it("fails closed without trusted network and refuses malformed events",async()=>{
    expect((await POST(request({ip:""}))).status).toBe(503)
    expect((await POST(request({body:{...payload,events:[{...payload.events[0],position:999}]}}))).status).toBe(400)
    expect((await POST(request({body:{...payload,events:new Array(21).fill(payload.events[0])}}))).status).toBe(400)
    expect(store.rpc).not.toHaveBeenCalled()
  })
  it("retries idempotently by deriving stable event digests per page and listing",async()=>{
    await POST(request()); const first=store.rpc.mock.calls[0][1].p_items[0].event_key
    await POST(request()); const second=store.rpc.mock.calls[1][1].p_items[0].event_key
    expect(first).toBe(second)
  })
})
