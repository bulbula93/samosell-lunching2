import { NextResponse } from "next/server"
import { isChatUuid } from "@/lib/chats"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await context.params
  const unavailable = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } })
  if (!isChatUuid(storyId)) return unavailable()
  const supabase = await createClient()
  const { data: story, error } = await supabase.from("stories").select("media_path, expires_at")
    .eq("id", storyId).is("deleted_at", null).gt("expires_at", new Date().toISOString()).maybeSingle()
  if (error || !story) return unavailable()
  const ttl = Math.min(60, Math.floor((Date.parse(story.expires_at) - Date.now()) / 1000))
  if (ttl < 1) return unavailable()
  const { data, error: signingError } = await supabase.storage.from("story-media").createSignedUrl(story.media_path, ttl)
  if (signingError || !data?.signedUrl) return unavailable()
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } })
}
