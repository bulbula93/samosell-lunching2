"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { saveSellerPhoneAction } from "@/app/dashboard/profile/phone-actions"
import { isValidSellerPhone, SELLER_PHONE_MAX_LENGTH } from "@/lib/phone"

export default function ProfilePhoneRequiredCard({ initialPhone = "" }: { initialPhone?: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const [phone, setPhone] = useState(initialPhone)
  const [error, setError] = useState("")
  const [needsLogin, setNeedsLogin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function savePhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || saved) return
    setError("")
    setNeedsLogin(false)
    if (!isValidSellerPhone(phone)) {
      setError("მიუთითე მოქმედი ტელეფონის ნომერი 7–15 ციფრით.")
      inputRef.current?.focus()
      return
    }
    submitting.current = true
    setBusy(true)
    try {
      const result = await saveSellerPhoneAction(phone)
      if (!result.ok) {
        setError(result.message)
        setNeedsLogin(result.code === "unauthorized")
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError("შენახვის პასუხი ვერ მივიღეთ. შენი შეყვანილი ნომერი აქ რჩება — სცადე ხელახლა.")
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <section className="ui-card mx-auto w-full max-w-5xl p-6 sm:p-8" aria-labelledby="listing-phone-title">
      <div className="space-y-5">
        <div className="max-w-2xl">
          <p className="ui-eyebrow">საკონტაქტო ინფორმაცია</p>
          <h1 id="listing-phone-title" className="mt-2 text-2xl font-black tracking-tight text-text sm:text-3xl">
            დაამატე ნომერი და გააგრძელე
          </h1>
          <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
            განცხადების დასამატებლად საჭიროა საკონტაქტო ნომერი. შენახვის შემდეგ აქვე გაიხსნება ნივთის დამატების ფორმა.
          </p>
        </div>
        <form onSubmit={savePhone} noValidate className="max-w-lg space-y-3" aria-label="განცხადებისთვის ტელეფონის დამატება">
          <label htmlFor="listing-seller-phone" className="ui-field-label">ტელეფონის ნომერი</label>
          <input ref={inputRef} id="listing-seller-phone" type="tel" inputMode="tel" autoComplete="tel" required
            maxLength={SELLER_PHONE_MAX_LENGTH} value={phone} disabled={busy || saved}
            onChange={(event) => { setPhone(event.target.value); setError("") }}
            aria-invalid={Boolean(error)} aria-describedby={`listing-phone-help${error ? " listing-phone-error" : ""}`}
            placeholder="მაგ: +995 555 12 34 56" className="ui-input min-h-12 w-full text-base" />
          <p id="listing-phone-help" className="text-xs leading-6 text-text-soft">ნომერი შენს პროფილში შეინახება და განცხადებაზე დაინტერესებულ მყიდველებს გამოუჩნდებათ.</p>
          {error ? <p id="listing-phone-error" role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}
          {needsLogin ? <Link href="/login?next=%2Fdashboard%2Flistings%2Fnew" className="ui-btn-secondary">ანგარიშში შესვლა</Link> : null}
          {saved ? <div role="status" className="space-y-2 text-sm font-bold text-brand">
            <p>ნომერი შენახულია. განცხადების ფორმა იტვირთება…</p>
            <a href="/dashboard/listings/new" className="inline-flex min-h-11 items-center underline">ფორმის გახსნა →</a>
          </div> : <button type="submit" disabled={busy} className="ui-btn-primary min-h-12 w-full sm:w-auto">{busy ? "ინახება…" : "შეინახე და გააგრძელე"}</button>}
        </form>
        <Link href="/dashboard/profile" className="inline-flex min-h-11 items-center text-sm font-bold text-brand underline">პროფილის რედაქტირება</Link>
      </div>
    </section>
  )
}
