"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function ForgotPasswordForm({ initialError = "" }: { initialError?: string }) {
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [error, setError] = useState(initialError)
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const redirectUrl = new URL("/auth/callback", window.location.origin)
      redirectUrl.searchParams.set("next", "/reset-password")

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl.toString(),
      })

      if (resetError) {
        const message = resetError.message.toLowerCase()
        if (resetError.status === 429 || message.includes("rate limit")) {
          setError("ძალიან ბევრი მოთხოვნაა. ცოტა ხანში ცადე თავიდან.")
        } else {
          setError("აღდგენის ბმულის გაგზავნა ვერ მოხერხდა. ცადე თავიდან.")
        }
        setLoading(false)
        return
      }

      setSuccess("თუ ამ ელფოსტით ანგარიში არსებობს, პაროლის აღდგენის ბმული გამოგზავნილია. გადაამოწმე Inbox და Spam.")
      setLoading(false)
    } catch {
      setError("აღდგენის ბმულის გაგზავნა ვერ მოხერხდა. ცადე თავიდან.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="forgot-email" className="mb-2 block text-sm font-black text-brand">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-[16px] outline-none transition placeholder:text-neutral-400 focus:border-brand/45 focus:ring-4 focus:ring-[#dff5ef] sm:text-sm"
          placeholder="you@example.com"
        />
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-700">
          {success}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading || Boolean(success)}
        className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#ff6f0f] px-5 font-black text-white shadow-[0_8px_24px_rgba(255,111,15,0.22)] transition hover:-translate-y-0.5 hover:bg-[#ed6208] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "იგზავნება..." : success ? "ბმული გაგზავნილია" : "აღდგენის ბმულის გაგზავნა"}
      </button>
    </form>
  )
}
