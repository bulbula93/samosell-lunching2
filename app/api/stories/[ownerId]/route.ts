import { NextResponse } from "next/server"
import { isChatUuid } from "@/lib/chats"
import { getOwnerStories } from "@/lib/story-data"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(_request: Request, context: { params: Promise<{ ownerId: string }> }) {
  const { ownerId } = await context.params
  if (!isChatUuid(ownerId)) return NextResponse.json({ stories: [] }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  try {
    const stories = await getOwnerStories(supabase, ownerId, user?.id)
    return NextResponse.json({ stories }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ stories: [] }, { status: 404, headers: { "Cache-Control": "private, no-store" } })
  }
}
