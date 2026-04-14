export const dynamic = "force-dynamic"
export const revalidate = 0

import type { Metadata } from "next"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/dashboard/DashboardHeader"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const chatFilter = `buyer_id.eq.${user.id},seller_id.eq.${user.id}`

  const [profileResponse, favoriteCountResponse, unreadThreadsResponse] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("chat_threads").select("unread_count").or(chatFilter).eq("is_archived", false),
  ])

  const unreadMessages = (unreadThreadsResponse.data ?? []).reduce((sum, item) => sum + (item.unread_count ?? 0), 0)

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <DashboardHeader
        email={user.email}
        isAdmin={Boolean(profileResponse.data?.is_admin)}
        favoriteCount={favoriteCountResponse.count ?? 0}
        unreadMessages={unreadMessages}
      />
      {children}
    </div>
  )
}
