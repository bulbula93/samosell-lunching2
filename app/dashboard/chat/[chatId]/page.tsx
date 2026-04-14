import { permanentRedirect } from "next/navigation"

export default async function LegacyChatThreadRedirectPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  permanentRedirect(`/dashboard/chats/${chatId}`)
}
