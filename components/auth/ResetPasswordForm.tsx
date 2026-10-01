"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordForm() {
  const supabase = createClient()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("ახალი პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს.")
      return
    }

    if (password !== confirmPassword) {
      setError("პაროლები ერთმანეთს არ ემთხვევა. ცადე თავიდან.")
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      const message = updateError.message.toLowerCase()
      if (message.includes("same password") || message.includes("different")) {
        setError("აირჩიე წინა პაროლისგან განსხვავებული ახალი პაროლი.")
      } else {
        setError("პაროლის შეცვლა ვერ მოხერხდა. აღდგენის ბმული შესაძლოა ვადაგასული იყოს. ცადე თავიდან.")
      }
      setLoading(false)
      return
    }

    await supabase.auth.signOut({ scope: "local" })
    window.location.replace("/login?password_reset=success")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="mb-2 block text-sm font-black text-brand">
          ახალი პაროლი
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 pr-12 text-[16px] outline-none transition placeholder:text-neutral-400 focus:border-brand/45 focus:ring-4 focus:ring-[#dff5ef] sm:text-sm"
            placeholder="მინიმუმ 6 სიმბოლო"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "პაროლის დამალვა" : "პაროლის ჩვენება"}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span aria-hidden="true">{showPassword ? "◉" : "○"}</span>
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="confirm-password" className="mb-2 block text-sm font-black text-brand">
          გაიმეორე ახალი პაროლი
        </label>
        <input
          id="confirm-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="h-12 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-[16px] outline-none transition placeholder:text-neutral-400 focus:border-brand/45 focus:ring-4 focus:ring-[#dff5ef] sm:text-sm"
          placeholder="გაიმეორე პაროლი"
        />
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#ff6f0f] px-5 font-black text-white shadow-[0_8px_24px_rgba(255,111,15,0.22)] transition hover:-translate-y-0.5 hover:bg-[#ed6208] disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "ინახება..." : "ახალი პაროლის შენახვა"}
      </button>
    </form>
  )
}
