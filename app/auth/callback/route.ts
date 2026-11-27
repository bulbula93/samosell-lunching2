import { NextResponse } from "next/server"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { createClient } from "@/lib/supabase/server"
import { getSiteUrlEnv } from "@/lib/env"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = getSafeAuthRedirectPath(requestUrl.searchParams.get("next"))
  const redirectOrigin =
    process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview"
      ? requestUrl.origin
      : getSiteUrlEnv()

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, redirectOrigin))
    }
  }

  if (next === "/reset-password") {
    const recoveryUrl = new URL("/forgot-password", redirectOrigin)
    recoveryUrl.searchParams.set("error", "invalid_or_expired")
    return NextResponse.redirect(recoveryUrl)
  }

  const loginUrl = new URL("/login", redirectOrigin)
  // Signup confirmation links only reach us with a `code` after Supabase has
  // already confirmed the email. If the session exchange fails here (typically
  // the link was opened in another browser / a mail app, so the PKCE verifier
  // cookie is missing), the account is still confirmed: ask for a password login
  // instead of showing a misleading "social login failed" error.
  const isEmailConfirmation = requestUrl.searchParams.get("flow") === "email_signup"
  loginUrl.searchParams.set("error", code && isEmailConfirmation ? "email_confirmed_login" : "oauth_callback_failed")
  loginUrl.searchParams.set("next", next)
  return NextResponse.redirect(loginUrl)
}
