import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { createClient } from "@/lib/supabase/server"
import { getSiteUrlEnv } from "@/lib/env"

// Email links (signup confirmation, password recovery) that carry a token_hash.
// Unlike the PKCE `code` flow in /auth/callback, verifying a token_hash needs no
// browser-stored code verifier, so it works when the email is opened in a
// different browser or a mail app's in-app browser.
const ALLOWED_TYPES = new Set<EmailOtpType>(["signup", "email", "recovery", "email_change", "invite", "magiclink"])

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const rawType = requestUrl.searchParams.get("type") as EmailOtpType | null
  const type = rawType && ALLOWED_TYPES.has(rawType) ? rawType : null
  const fallbackNext = type === "recovery" ? "/reset-password" : "/"
  const next = getSafeAuthRedirectPath(requestUrl.searchParams.get("next"), fallbackNext)
  const redirectOrigin =
    process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview"
      ? requestUrl.origin
      : getSiteUrlEnv()

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    if (!error) {
      return NextResponse.redirect(new URL(next, redirectOrigin))
    }
  }

  if (type === "recovery" || next === "/reset-password") {
    const recoveryUrl = new URL("/forgot-password", redirectOrigin)
    recoveryUrl.searchParams.set("error", "invalid_or_expired")
    return NextResponse.redirect(recoveryUrl)
  }

  const loginUrl = new URL("/login", redirectOrigin)
  loginUrl.searchParams.set("error", "email_link_invalid")
  loginUrl.searchParams.set("next", next)
  return NextResponse.redirect(loginUrl)
}
