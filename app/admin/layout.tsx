export const dynamic = "force-dynamic"
export const revalidate = 0

import type { Metadata } from "next"
import { requireAdminUser } from "@/lib/auth"
import DashboardHeader from "@/components/dashboard/DashboardHeader"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireAdminUser("/dashboard")

  const chatFilter = `buyer_id.eq.${user.id},seller_id.eq.${user.id}`
  const [unreadThreadsResponse, supportThreadsResponse] = await Promise.all([
    supabase.from("chat_threads").select("unread_count").or(chatFilter).eq("is_archived", false),
    supabase.from("chat_threads").select("unread_count").eq("chat_type", "support").eq("is_archived", false),
  ])
  const unreadMessages = (unreadThreadsResponse.data ?? []).reduce((sum, item) => sum + (item.unread_count ?? 0), 0)
  const supportUnreadConversations = (supportThreadsResponse.data ?? []).filter(
    (item) => (item.unread_count ?? 0) > 0,
  ).length

  return (
    <div className="min-h-screen bg-bg text-text">
      <DashboardHeader
        email={user.email}
        isAdmin
        unreadMessages={unreadMessages}
        supportUnreadConversations={supportUnreadConversations}
      />
      {children}
    </div>
  )
}
