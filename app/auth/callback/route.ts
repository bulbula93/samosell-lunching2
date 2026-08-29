import { NextResponse } from "next/server"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { createClient } from "@/lib/supabase/server"
import { getSiteUrlEnv } from "@/lib/env"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = getSafeAuthRedirectPath(requestUrl.searchParams.get("next"))
  const redirectOrigin = process.env.NODE_ENV === "development" ? requestUrl.origin : getSiteUrlEnv()

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, redirectOrigin))
    }
  }

  const loginUrl = new URL("/login", redirectOrigin)
  loginUrl.searchParams.set("error", "oauth_callback_failed")
  loginUrl.searchParams.set("next", next)
  return NextResponse.redirect(loginUrl)
}
