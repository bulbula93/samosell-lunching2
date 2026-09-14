// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { prepareStoryUploadAction, publishStoryAction, recordStoryListingClickAction } from "@/app/stories/actions"
import { videoFixture } from "./fixtures/story-video"
const mocks=vi.hoisted(()=>({createClient:vi.fn(),createAdminClient:vi.fn()}))
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.createClient}))
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:mocks.createAdminClient}))
vi.mock("@/lib/notifications",()=>({notifyChatMessage:vi.fn()}))
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}))
const user="11111111-1111-4111-8111-111111111111"
const storyId="22222222-2222-4222-8222-222222222222"
const path=`${user}/${storyId}/33333333-3333-4333-8333-333333333333.webm`
beforeEach(()=>vi.clearAllMocks())

function context(blob:Blob, planOverrides={}) {
  const rpc=vi.fn(async(name:string)=>({data:name==="create_story"?storyId:null,error:null}))
  mocks.createClient.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:user}},error:null})},rpc})
  const update=vi.fn().mockReturnThis()
  const builder={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),update,
    maybeSingle:async()=>({data:{mime_type:blob.type,expected_size:blob.size,uploaded_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString(),...planOverrides},error:null}),
    then(resolve:(v:unknown)=>void){resolve({data:[],error:null})}}
  const download=vi.fn().mockResolvedValue({data:blob,error:null})
  mocks.createAdminClient.mockReturnValue({from:()=>builder,storage:{from:()=>({download,remove:vi.fn()})}})
  return {rpc,update,download}
}
describe("Story server action security regressions",()=>{
  it("rejects spoofed 1-second client duration for a 16-second uploaded video",async()=>{
    const {rpc,update}=context(await videoFixture(16))
    expect(await publishStoryAction({storyId,path,mediaType:"video",durationMs:1000})).toMatchObject({ok:false})
    expect(rpc.mock.calls.some(([name])=>name==="create_story")).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })
  it("publishes the parsed duration, ignoring an arbitrary client duration",async()=>{
    const {rpc,update}=context(await videoFixture(3))
    expect(await publishStoryAction({storyId,path,mediaType:"video",durationMs:1})).toMatchObject({ok:true})
    expect(update).toHaveBeenCalledWith(expect.objectContaining({duration_ms:3000}))
    expect(rpc).toHaveBeenCalledWith("create_story",expect.objectContaining({p_duration_ms:3000}))
  })
  it("does not download or publish a revoked plan",async()=>{
    const {download}=context(await videoFixture(1),{revoked_at:new Date().toISOString()})
    expect(await publishStoryAction({storyId,path,mediaType:"video",durationMs:1000})).toMatchObject({ok:false})
    expect(download).not.toHaveBeenCalled()
  })
  it("does not issue signed uploads when the authoritative quota rejects a plan",async()=>{
    mocks.createClient.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:user}},error:null})},rpc:async()=>({data:null,error:{message:"story_rate_limited"}})})
    expect(await prepareStoryUploadAction({mimeType:"video/webm",size:100})).toMatchObject({ok:false})
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })
  it("does not persist anonymous clicks",async()=>{
    const rpc=vi.fn()
    mocks.createClient.mockResolvedValue({auth:{getUser:async()=>({data:{user:null},error:null})},rpc})
    expect(await recordStoryListingClickAction(storyId)).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
})
