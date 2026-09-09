// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest"
import { GET } from "@/app/api/stories/media/[storyId]/route"
const mocks=vi.hoisted(()=>({createClient:vi.fn()}))
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.createClient}))
const id="11111111-1111-4111-8111-111111111111"
const request=()=>GET(new Request(`https://example.test/api/stories/media/${id}`),{params:Promise.resolve({storyId:id})})
beforeEach(()=>vi.clearAllMocks())
it("checks caller RLS and active state before signing private media",async()=>{
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),gt:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:null,error:null})}
  const createSignedUrl=vi.fn()
  mocks.createClient.mockResolvedValue({from:()=>query,storage:{from:()=>({createSignedUrl})}})
  expect((await request()).status).toBe(404)
  expect(query.is).toHaveBeenCalledWith("deleted_at",null)
  expect(query.gt).toHaveBeenCalledWith("expires_at",expect.any(String))
  expect(createSignedUrl).not.toHaveBeenCalled()
})
it("caps URL TTL at Story expiry and uses a no-store redirect",async()=>{
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),gt:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{media_path:"safe/path.jpg",expires_at:new Date(Date.now()+30_000).toISOString()},error:null})}
  const createSignedUrl=vi.fn().mockResolvedValue({data:{signedUrl:"https://storage.example.test/signed"},error:null})
  mocks.createClient.mockResolvedValue({from:()=>query,storage:{from:()=>({createSignedUrl})}})
  const response=await request()
  expect(response.status).toBe(307)
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(createSignedUrl.mock.calls[0][1]).toBeGreaterThan(0)
  expect(createSignedUrl.mock.calls[0][1]).toBeLessThanOrEqual(30)
})
