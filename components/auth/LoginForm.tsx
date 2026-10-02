"use client"

import Link from "next/link"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import SocialAuthButtons from "@/components/auth/SocialAuthButtons"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"

function FieldIcon({ kind }: { kind: "email" | "password" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
        kind === "email" ? "bg-[#e8f7f2] text-brand" : "bg-[#fff0d7] text-[#e96b10]"
      }`}
    >
      {kind === "email" ? (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9">
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <path d="m5 7 7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9">
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}

function getLoginErrorMessage(authError: { code?: string; message?: string; status?: number }) {
  const code = authError.code?.toLowerCase() ?? ""
  const message = authError.message?.toLowerCase() ?? ""

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "ელფოსტა ან პაროლი არასწორია. ცადე თავიდან."
  }

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "ელფოსტა ჯერ არ არის დადასტურებული. გადაამოწმე ელფოსტა და ცადე თავიდან."
  }

  if (authError.status === 429 || code.includes("rate_limit") || message.includes("rate limit")) {
    return "ძალიან ბევრი მცდელობაა. ცოტა ხანში ცადე თავიდან."
  }

  return "შესვლა ვერ მოხერხდა. გადაამოწმე მონაცემები და ცადე თავიდან."
}

export default function LoginForm({
  nextPath,
  initialError,
  initialSuccess,
}: {
  nextPath?: string
  initialError?: string
  initialSuccess?: string
}) {
  const supabase = createClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(initialError || "")
  const [success] = useState(initialSuccess || "")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError(getLoginErrorMessage(authError))
      setLoading(false)
      return
    }

    window.location.replace(getSafeAuthRedirectPath(nextPath))
  }

  return (
    <div className="space-y-5">
      <SocialAuthButtons mode="login" nextPath={nextPath} />

      {success ? (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="mb-2 flex items-center gap-2 text-sm font-black text-brand">
            <FieldIcon kind="email" />
            <span className="underline decoration-[#8bdcc8] decoration-2 underline-offset-4">Email</span>
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-[16px] outline-none transition placeholder:text-neutral-400 focus:border-brand/45 focus:ring-4 focus:ring-[#dff5ef] sm:text-sm"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="login-password" className="flex items-center gap-2 text-sm font-black text-brand">
              <FieldIcon kind="password" />
              <span className="underline decoration-[#ffc45b] decoration-2 underline-offset-4">Password</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-bold text-[#e96b10] transition hover:text-[#c95708] hover:underline"
            >
              პაროლი დაგავიწყდა?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 pr-12 text-[16px] outline-none transition placeholder:text-neutral-400 focus:border-brand/45 focus:ring-4 focus:ring-[#dff5ef] sm:text-sm"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "პაროლის დამალვა" : "პაროლის ჩვენება"}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 3l18 18" strokeLinecap="round" />
                  <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.3A10.5 10.5 0 0 1 12 4c5.5 0 9 5 9 8a10.7 10.7 0 0 1-2.1 3.8M6.2 6.2C4.1 7.7 3 10 3 12c0 3 3.5 8 9 8 1.7 0 3.2-.5 4.4-1.2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 12c0-3 3.5-8 9-8s9 5 9 8-3.5 8-9 8-9-5-9-8Z" />
                  <circle cx="12" cy="12" r="2.6" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="group mt-1 flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-[#ff6f0f] px-5 font-black text-white shadow-[0_8px_24px_rgba(255,111,15,0.22)] transition hover:-translate-y-0.5 hover:bg-[#ed6208] hover:shadow-[0_12px_28px_rgba(255,111,15,0.28)] active:translate-y-0 disabled:cursor-wait disabled:opacity-60"
        >
          <span>{loading ? "იტვირთება..." : "შედი"}</span>
          {!loading ? (
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 transition duration-200 group-hover:scale-110"
            >
              <svg
                viewBox="0 0 28 24"
                className="h-[21px] w-[24px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 4.5h12v15H8z" />
                <path d="M8 5.5 3.5 8v11l4.5-1.8" />
                <path d="m20 5.5 4.5 2.5v11L20 17.2" />
                <path d="M14 7.2c0-1 .7-1.7 1.6-1.7.8 0 1.4.6 1.4 1.3 0 .8-.6 1.2-1.4 1.6v1.1" />
                <path d="m10.2 13.4 4.2-2.5 4.1 2.5" />
                <path d="M11.4 13.2h6l1 3.6h-8l1-3.6Z" />
              </svg>
            </span>
          ) : null}
        </button>
      </form>
    </div>
  )
}
