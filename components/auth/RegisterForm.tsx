"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import SocialAuthButtons from "@/components/auth/SocialAuthButtons"
import { getRegistrationContinuePath, isStoreSetupPath } from "@/lib/store-onboarding"
import { isReadOnlyPreview } from "@/lib/preview-read-only"

export default function RegisterForm({ nextPath }: { nextPath?: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [sellerType, setSellerType] = useState<"individual" | "store">(() => isStoreSetupPath(nextPath) ? "store" : "individual")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const continuePath = getRegistrationContinuePath(sellerType, nextPath)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    if (isReadOnlyPreview()) {
      setError("ეს Preview მხოლოდ სანახავადაა — რეგისტრაცია გამორთულია")
      return
    }
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(continuePath)}`,
          data: {
            username: username.trim() || undefined,
            full_name: fullName.trim(),
            seller_type: sellerType,
          },
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      if (data?.session) { router.push(continuePath); router.refresh(); return }
      setSuccess(
        sellerType === "store"
          ? "დაადასტურე ანგარიში ელფოსტაზე გამოგზავნილი ბმულით — შემდეგ მაღაზიის შექმნას კონსტრუქტორში გააგრძელებ"
          : "გადაამოწმე ელფოსტა და დაადასტურე ანგარიში გამოგზავნილი ბმულით"
      )
    } catch {
      setError("რეგისტრაცია ვერ დასრულდა — სცადე ხელახლა")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <fieldset disabled={loading} className="space-y-3">
        <legend className="mb-3 text-sm font-bold text-brand">როგორ გინდა გაყიდვა?</legend>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: "individual", label: "ფიზიკური გამყიდველი", hint: "შენი პირადი კარადიდან" },
            { value: "store", label: "მაღაზია", hint: "ბრენდი ან ონლაინ მაღაზია" },
          ] as const).map(({ value, label, hint }) => (
            <label key={value} className={`cursor-pointer rounded-2xl border p-3 transition focus-within:ring-2 focus-within:ring-brand/30 ${sellerType === value ? "border-brand/35 bg-brand-soft/50" : "border-line bg-white hover:border-brand/25"}`}>
              <input type="radio" name="seller-type" value={value} checked={sellerType === value}
                onChange={() => { setSellerType(value); setError(""); setSuccess("") }} className="mb-2 h-4 w-4 accent-brand" />
              <span className="block text-sm font-bold text-brand">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-text-soft">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {sellerType === "store" ? <p className="rounded-2xl bg-[#fff8f0] p-4 text-sm leading-6 text-text-soft">შექმენი ანგარიში — შემდეგ შენს მაღაზიას კონსტრუქტორში ააწყობ, დაამატებ ქავერს, ლოგოს და საკონტაქტო ინფორმაციას</p> : null}
      <SocialAuthButtons mode="register" nextPath={continuePath} />

      <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="register-name" className="mb-2 block text-sm font-semibold">{sellerType === "store" ? "მაღაზიის სახელი" : "სრული სახელი"}</label>
        <input
          id="register-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none"
          placeholder={sellerType === "store" ? "ჩემი მაღაზია" : "გიორგი"}
        />
      </div>

      <div>
        <label htmlFor="register-username" className="mb-2 block text-sm font-semibold">Username</label>
        <input
          id="register-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none"
          placeholder="zuka_style"
        />
      </div>

      <div>
        <label htmlFor="register-email" className="mb-2 block text-sm font-semibold">Email</label>
        <input
          id="register-email"
          autoComplete="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 w-full rounded-2xl border border-neutral-300 px-4 outline-none"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="register-password" className="mb-2 block text-sm font-semibold">Password</label>
        <input
          id="register-password"
          autoComplete="new-password"
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
        {loading ? "იტვირთება..." : sellerType === "store" ? "შექმენი ანგარიში და გააგრძელე" : "რეგისტრაცია"}
      </button>
      </form>
      <p className="pt-3 text-center text-sm text-text-soft">უკვე გაქვს ანგარიში?{" "}
        <Link href={`/login?next=${encodeURIComponent(continuePath)}`} className="font-black text-[#f06f16] underline underline-offset-4">შესვლა →</Link>
      </p>
    </div>
  )
}
