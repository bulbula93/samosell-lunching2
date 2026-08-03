import { redirect } from "next/navigation"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { createClient } from "@/lib/supabase/server"

export async function requireAuthenticatedUser(nextPath?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const next = getSafeAuthRedirectPath(nextPath, "/dashboard")
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  return { supabase, user }
}

export async function requireAdminUser(nextPath = "/dashboard") {
  const { supabase, user } = await requireAuthenticatedUser(nextPath)

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    redirect(nextPath)
  }

  return { supabase, user, profile }
}
