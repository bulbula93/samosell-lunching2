"use client"

import { useRouter } from "next/navigation"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import SocialAuthButtons from "@/components/auth/SocialAuthButtons"

export default function RegisterForm({ nextPath }: { nextPath?: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeAuthRedirectPath(nextPath))}`,
        data: {
          username,
          full_name: fullName,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data?.session) { router.push(getSafeAuthRedirectPath(nextPath)); router.refresh(); setLoading(false); return }
    setSuccess(
      "გადაამოწმე ელფოსტა და დაადასტურე ანგარიში გამოგზავნილი ბმულით."
    )
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <SocialAuthButtons mode="register" nextPath={nextPath} />

      <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold">სრული სახელი</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none"
          placeholder="გიორგი"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none"
          placeholder="zuka_style"
        />
      </div>

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
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none"
          placeholder="მინიმუმ 6 სიმბოლო"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-2xl bg-black px-6 font-semibold text-white disabled:opacity-60"
      >
        {loading ? "იტვირთება..." : "რეგისტრაცია"}
      </button>
      </form>
    </div>
  )
}
