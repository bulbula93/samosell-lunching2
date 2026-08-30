export const dynamic = "force-dynamic"
export const revalidate = 0

import type { Metadata } from "next"
import { redirect } from "next/navigation"
import SiteHeader from "@/components/layout/SiteHeader"
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

  return (
    <div className="min-h-screen bg-bg text-text">
      <SiteHeader authenticatedUser={user} />
      {children}
    </div>
  )
}
