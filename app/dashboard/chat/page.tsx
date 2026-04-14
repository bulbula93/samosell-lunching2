import { permanentRedirect } from "next/navigation"

export default function LegacyChatInboxRedirectPage() {
  permanentRedirect("/dashboard/chats")
}
