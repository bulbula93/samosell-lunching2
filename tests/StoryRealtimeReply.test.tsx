import { act, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import ChatThreadClient from "@/components/chat/ChatThreadClient"
import type { ChatMessage } from "@/types/chat"

const mocks=vi.hoisted(()=>({ hydrate:vi.fn(),receive:null as null | ((payload:{new:ChatMessage})=>void) }))
vi.mock("@/app/dashboard/chats/actions",()=>({loadRealtimeMessageAction:mocks.hydrate,markChatReadAction:vi.fn(),sendChatMessageAction:vi.fn(),loadOlderMessagesAction:vi.fn()}))
vi.mock("@/lib/supabase/client",()=>({createClient:()=>({channel:()=>({on(_event:string,_filter:unknown,callback:typeof mocks.receive){mocks.receive=callback;return this},subscribe(){return this}}),removeChannel:vi.fn()})}))

it("hydrates a received Story reply without a page reload, preserving its body",async()=>{
  const message:ChatMessage={id:"message",chat_id:"chat",sender_id:"other",body:"realtime body",created_at:new Date().toISOString(),story_id:"story",message_type:"story_reply"}
  mocks.hydrate.mockResolvedValue({...message,story_context:{available:true,caption:"realtime Story caption",linkedListingSlug:"linked-item"}})
  render(<ChatThreadClient chatId="chat" currentUserId="me" initialMessages={[]} otherPartyLabel="Other" canSend={true} initialHasMore={false}/> )
  await act(async()=>{mocks.receive?.({new:message})})
  expect(await screen.findByText("realtime Story caption")).toBeInTheDocument()
  expect(screen.getByText("realtime body")).toBeInTheDocument()
  expect(screen.getByRole("link",{name:"ნივთის ნახვა"})).toHaveAttribute("href","/listing/linked-item")
  expect(mocks.hydrate).toHaveBeenCalledWith("chat","message")
})
