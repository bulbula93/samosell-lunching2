"use client"

import Link from "next/link"
import { useState, useTransition, type FormEvent } from "react"
import { sendSupportMessageAction } from "@/app/contact/actions"

const CATEGORY_OPTIONS = [
  { value: "account", label: "ანგარიში" },
  { value: "listing", label: "განცხადება" },
  { value: "chat", label: "ჩათი" },
  { value: "technical", label: "ტექნიკური პრობლემა" },
  { value: "safety", label: "უსაფრთხოება" },
  { value: "other", label: "სხვა საკითხი" },
] as const

export default function SupportContactCard({
  userEmail,
  supportEmail,
}: {
  userEmail: string | null
  supportEmail: string
}) {
  const [category, setCategory] = useState("account")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userEmail || pending) return

    setFeedback(null)
    startTransition(async () => {
      const result = await sendSupportMessageAction({ category, subject, message })
      setFeedback(result)
      if (result.ok) {
        setSubject("")
        setMessage("")
      }
    })
  }

  return (
    <section className="mt-8 rounded-[1.75rem] border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500">
            მხარდაჭერა
          </div>
          <h2 className="mt-2 text-2xl font-black text-neutral-900">მოგვწერე პირდაპირ საიტიდან</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            წერილისთვის ცალკე ელფოსტის აპი არ გაიხსნება. მოთხოვნა პირდაპირ {supportEmail}-ზე გაიგზავნება.
          </p>
        </div>
      </div>

      {!userEmail ? (
        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-sm leading-6 text-neutral-700">
            საიტიდან მხარდაჭერასთან მოსაწერად ჯერ შედი ანგარიშში. ასე პასუხიც შენს ანგარიშზე მიბმულ ელფოსტაზე მოვა.
          </p>
          <Link href="/login?next=%2Fcontact" className="mt-4 inline-flex rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800">
            ანგარიშში შესვლა
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
              შენი ელფოსტა
              <input
                value={userEmail}
                readOnly
                aria-readonly="true"
                className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-600 outline-none"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
              საკითხის ტიპი
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={pending}
                className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
            სათაური
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              minLength={3}
              maxLength={120}
              required
              disabled={pending}
              placeholder="მაგ. განცხადების ატვირთვის პრობლემა"
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
            შეტყობინება
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={10}
              maxLength={4000}
              required
              disabled={pending}
              rows={6}
              placeholder="აღწერე პრობლემა ან შეკითხვა რაც შეიძლება დეტალურად..."
              className="resize-y rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm leading-6 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-neutral-500">
              პასუხს მიიღებ <strong>{userEmail}</strong>-ზე.
            </p>
            <button
              type="submit"
              disabled={pending || subject.trim().length < 3 || message.trim().length < 10}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "იგზავნება…" : "გაგზავნა"}
            </button>
          </div>

          {feedback ? (
            <div
              role={feedback.ok ? "status" : "alert"}
              aria-live="polite"
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                feedback.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}
        </form>
      )}
    </section>
  )
}
