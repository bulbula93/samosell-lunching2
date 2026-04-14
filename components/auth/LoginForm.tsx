"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import SocialAuthButtons from "@/components/auth/SocialAuthButtons"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"

export default function LoginForm({
  nextPath,
  initialError,
}: {
  nextPath?: string
  initialError?: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(initialError || "")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(getSafeAuthRedirectPath(nextPath))
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <SocialAuthButtons mode="login" nextPath={nextPath} />

      <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none"
          placeholder="••••••••"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-2xl bg-black px-6 font-semibold text-white disabled:opacity-60"
      >
        {loading ? "იტვირთება..." : "შესვლა"}
      </button>
      </form>
    </div>
  )
}
