import { describe, it, expect, vi } from "vitest"
import { hydrateStoryContexts } from "@/lib/chat-story-context"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ChatMessage } from "@/types/chat"

function message(story_id: string | null): ChatMessage {
  return { id:"message", chat_id:"chat", sender_id:"sender", body:"reply remains", created_at:"2026-09-09", message_type:"story_reply", story_id }
}
it("batch hydrates active contexts, hides inaccessible/deleted contexts and inactive listing links", async () => {
  const query = {select:vi.fn().mockReturnThis(),in:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),gt:vi.fn().mockResolvedValue({data:[
    {id:"active",caption:"caption",listing:{slug:"safe",status:"active"}},
    {id:"inactive-listing",caption:"other",listing:[{slug:"private",status:"archived"}]},
  ],error:null})}
  const from=vi.fn().mockReturnValue(query)
  const rows=[message("active"),message("active"),message("expired"),message(null),message("inactive-listing")]
  await hydrateStoryContexts({from} as unknown as SupabaseClient,rows)
  expect(from).toHaveBeenCalledTimes(1)
  expect(query.in).toHaveBeenCalledWith("id",["active","expired","inactive-listing"])
  expect(query.is).toHaveBeenCalledWith("deleted_at",null)
  expect(query.gt).toHaveBeenCalledWith("expires_at",expect.any(String))
  expect(rows[0].story_context).toEqual({available:true,caption:"caption",linkedListingSlug:"safe"})
  expect(rows[2].story_context?.available).toBe(false)
  expect(rows[3].story_context?.available).toBe(false)
  expect(rows[4].story_context?.linkedListingSlug).toBeNull()
  expect(rows.every(row=>row.body==="reply remains")).toBe(true)
})
describe("context loading failures", () => {
  it("avoids querying Stories for plain text messages",async()=>{
    const from=vi.fn()
    await hydrateStoryContexts({from} as unknown as SupabaseClient,[])
    expect(from).not.toHaveBeenCalled()
  })
})
