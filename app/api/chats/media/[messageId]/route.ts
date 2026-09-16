import { NextResponse } from "next/server"
import { CHAT_IMAGE_BUCKET } from "@/lib/chat-images"
import { isChatUuid } from "@/lib/chats"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

function unavailable(status = 404) {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params
  if (!isChatUuid(messageId)) return unavailable()

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return unavailable(401)

  const { data: message, error } = await supabase
    .from("messages")
    .select("id, message_type, media_path")
    .eq("id", messageId)
    .maybeSingle()

  if (
    error ||
    !message ||
    message.message_type !== "image" ||
    typeof message.media_path !== "string" ||
    !message.media_path
  ) {
    return unavailable()
  }

  const { data, error: signingError } = await createAdminClient()
    .storage
    .from(CHAT_IMAGE_BUCKET)
    .createSignedUrl(message.media_path, 60)

  if (signingError || !data?.signedUrl) return unavailable()

  return NextResponse.redirect(data.signedUrl, {
    headers: { "Cache-Control": "private, max-age=30" },
  })
}
