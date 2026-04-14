"use client"

import { useMemo, useState, type ReactNode } from "react"
import type { Provider } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"

type SocialAuthButtonsProps = {
  mode: "login" | "register"
  nextPath?: string
}

type SupportedProvider = Extract<Provider, "google">

const PROVIDERS: Array<{ provider: SupportedProvider; label: string; icon: ReactNode }> = [
  {
    provider: "google",
    label: "Google",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 4 1.5l2.7-2.6C17 3.4 14.8 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12Z" />
        <path fill="#34A853" d="M3.6 7.6l3.2 2.4C7.7 7.8 9.6 6 12 6c1.9 0 3.2.8 4 1.5l2.7-2.6C17 3.4 14.8 2.5 12 2.5 8.4 2.5 5.2 4.5 3.6 7.6Z" />
        <path fill="#FBBC05" d="M2.5 12c0 1.5.4 2.9 1.1 4.2l3.7-2.9c-.2-.5-.3-.8-.3-1.3s.1-.9.3-1.3L3.6 7.6A9.4 9.4 0 0 0 2.5 12Z" />
        <path fill="#4285F4" d="M12 21.5c2.7 0 5-1 6.7-2.6l-3.1-2.4c-.8.6-1.9 1-3.6 1-4 0-5.3-2.6-5.5-3.9l-3.7 2.9c1.6 3.2 4.8 5 9.2 5Z" />
      </svg>
    ),
  },
]

function getButtonLabel(mode: "login" | "register", providerLabel: string) {
  return mode === "login" ? `${providerLabel}-ით შესვლა` : `${providerLabel}-ით გაგრძელება`
}

export default function SocialAuthButtons({ mode, nextPath }: SocialAuthButtonsProps) {
  const supabase = useMemo(() => createClient(), [])
  const [loadingProvider, setLoadingProvider] = useState<SupportedProvider | null>(null)
  const [error, setError] = useState("")

  async function handleOAuthSignIn(provider: SupportedProvider) {
    setLoadingProvider(provider)
    setError("")

    try {
      const safeNext = getSafeAuthRedirectPath(nextPath)
      const redirectUrl = new URL("/auth/callback", window.location.origin)
      redirectUrl.searchParams.set("next", safeNext)

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl.toString(),
        },
      })

      if (authError) {
        setError(authError.message)
        setLoadingProvider(null)
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "სოციალური ავტორიზაცია ვერ დაიწყო.")
      setLoadingProvider(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        {PROVIDERS.map(({ provider, label, icon }) => {
          const isLoading = loadingProvider === provider
          return (
            <button
              key={provider}
              type="button"
              onClick={() => handleOAuthSignIn(provider)}
              disabled={Boolean(loadingProvider)}
              className="flex h-12 items-center justify-center gap-3 rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {icon}
              <span>{isLoading ? "იტვირთება..." : getButtonLabel(mode, label)}</span>
            </button>
          )
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">ან</span>
        </div>
      </div>
    </div>
  )
}
