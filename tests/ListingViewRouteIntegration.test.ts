// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const refs = vi.hoisted(() => ({
  userId: null as string | null,
  status: "active",
  sellerId: "11111111-1111-4111-8111-111111111111",
  listingId: "22222222-2222-4222-8222-222222222222",
}))
let database: PGlite

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: refs.listingId, seller_id: refs.sellerId, status: refs.status },
            error: null,
          }),
        }),
      }),
    }),
    auth: { getUser: async () => ({
      data: { user: refs.userId ? { id: refs.userId } : null },
      error: null,
    }) },
  }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (name: string, args: {
      p_listing_id: string;
      p_viewer_hash: string;
      p_network_hash: string;
    }) => {
      if (name !== "record_distinct_listing_view") return { data: null, error: Error("unknown RPC") }
      try {
        const result = await database.query<{ counted: boolean }>(
          "select public.record_distinct_listing_view($1,$2,$3) as counted",
          [args.p_listing_id,args.p_viewer_hash,args.p_network_hash],
        )
        return { data: result.rows[0]?.counted === true, error: null }
      } catch (error) {
        return { data: null, error }
      }
    },
  }),
}))

import { DELETE, POST } from "@/app/api/listing-view/route"

const consent = encodeURIComponent(JSON.stringify({
  version: 1,
  personalization: false,
  analytics: true,
  updatedAt: Date.now(),
}))
const origin = "https://samosell.ge"

function request({
  viewer = "",
  ip = "203.0.113.7",
  consented = true,
  listingId = refs.listingId,
  agent = "Mozilla/5.0 (X11; Linux x86_64)",
  requestOrigin = origin,
}: {
  viewer?: string;
  ip?: string;
  consented?: boolean;
  listingId?: string;
  agent?: string;
  requestOrigin?: string;
} = {}) {
  const headers: Record<string,string> = {
    origin: requestOrigin,
    "content-type": "application/json",
    "user-agent": agent,
    "sec-fetch-site": "same-origin",
    "x-vercel-forwarded-for": ip,
  }
  const cookies = [consented ? `samosell_browser_consent=${consent}` : "", viewer].filter(Boolean)
  if (cookies.length) headers.cookie = cookies.join("; ")
  return new Request(origin + "/api/listing-view", {
    method: "POST", headers, body: JSON.stringify({ listingId }),
  })
}

beforeAll(async () => {
  database = new PGlite()
  await database.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.listings (
      id uuid primary key, seller_id uuid not null, status text not null,
      views_count integer not null default 0
    );
    insert into public.listings(id,seller_id,status)
    values ('${refs.listingId}','${refs.sellerId}','active');
  `)
  await database.exec(readFileSync("supabase/migrations/20261012110000_listing_view_daily.sql", "utf8"))
}, 30000)
beforeEach(async () => {
  vi.unstubAllEnvs()
  vi.stubEnv("VERCEL_ENV","production")
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","local-test-only-very-long-signing-secret")
  refs.userId = null
  refs.status = "active"
  await database.exec(`
    truncate table public.listing_view_daily, public.listing_view_rate_windows;
    update public.listings set views_count=0;
  `)
})
afterAll(async () => { vi.unstubAllEnvs(); await database?.close() })

async function counted() {
  const r = await database.query<{ views_count: number }>(
    "select views_count from public.listings where id=$1", [refs.listingId],
  )
  return r.rows[0]?.views_count ?? -1
}

describe("listing view API with in-memory PostgreSQL", () => {
  it("counts once for one signed browser, counts a second browser independently", async () => {
    const first = await POST(request())
    expect(first.status).toBe(200)
    expect((await first.json()).counted).toBe(true)
    const browserCookie = first.headers.get("set-cookie")?.split(";")[0] ?? ""
    expect(browserCookie).toMatch(/^samosell_listing_viewer=[a-z0-9-]+\.[a-f0-9]{64}$/)
    expect(first.headers.get("set-cookie")).toContain("HttpOnly")
    const again = await POST(request({viewer:browserCookie}))
    expect((await again.json()).counted).toBe(false)
    const second = await POST(request({ip:"203.0.113.8"}))
    expect((await second.json()).counted).toBe(true)
    expect(await counted()).toBe(2)
  })

  it("does not count the owner, opted-out visitors, crawlers or inactive listings", async () => {
    refs.userId = refs.sellerId
    expect((await (await POST(request())).json()).counted).toBe(false)
    refs.userId = null
    expect((await (await POST(request({consented:false}))).json()).counted).toBe(false)
    expect((await (await POST(request({agent:"Googlebot/2.1"}))).json()).counted).toBe(false)
    refs.status = "draft"
    expect((await (await POST(request())).json()).counted).toBe(false)
    expect(await counted()).toBe(0)
  })

  it("blocks preview writes and rejects fake request origins", async () => {
    vi.stubEnv("VERCEL_ENV","preview")
    expect((await POST(request())).status).toBe(403)
    vi.stubEnv("VERCEL_ENV","production")
    expect((await POST(request({requestOrigin:"https://evil.example"}))).status).toBe(403)
    expect(await counted()).toBe(0)
  })

  it("requires Vercel's network header and protects identity from forged cookies", async () => {
    const missingIp = await POST(request({ip:""}))
    expect(missingIp.status).toBe(503)
    const fakeVisitorCookie = "samosell_listing_viewer=22222222-2222-4222-8222-222222222222."+"a".repeat(64)
    const first = await POST(request({viewer:fakeVisitorCookie}))
    const realCookie = first.headers.get("set-cookie")?.split(";")[0] ?? ""
    expect(realCookie).toBeTruthy()
    expect(realCookie).not.toBe(fakeVisitorCookie)
    const second = await POST(request({viewer:realCookie}))
    expect((await second.json()).counted).toBe(false)
  })

  it("limits reset-cookie farming to 30 per network per listing each day", async () => {
    let allowed = 0
    for (let i=0; i<35; i++) {
      const response = await POST(request())
      if ((await response.json()).counted) allowed++
    }
    expect(allowed).toBe(30)
    expect(await counted()).toBe(30)
  })

  it("allows a visitor to clear the tracking identity via same-origin DELETE", async () => {
    const requestDelete = new Request(origin+"/api/listing-view", {
      method:"DELETE", headers:{origin,"sec-fetch-site":"same-origin"},
    })
    const r = await DELETE(requestDelete)
    expect(r.status).toBe(200)
    expect(r.headers.get("set-cookie")).toMatch(/Max-Age=0/)
    expect(r.headers.get("set-cookie")).toContain("HttpOnly")
  })
})
