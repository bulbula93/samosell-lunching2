"use client"

import { FormEvent, useState } from "react"

type AgentReply = {
  role: "user" | "assistant"
  text: string
}

const QUICK_PROMPTS = [
  "დღეს რა არის ყველაზე პრიორიტეტული და რატომ?",
  "რეალურ Flitt გადახდებში რამე საყურადღებოა?",
  "მოდერაციის 24 საათზე ძველი backlog შემაჯამე",
  "Support-ში რომელი საკითხებია სასწრაფო?",
  "მაღაზიებში რა ადმინისტრაციული ხარვეზებია?",
  "შემომთავაზე დღევანდელი admin checklist",
]

export default function AdminAgentClient({
  initialSummary,
  aiEnabled,
}: {
  initialSummary: string
  aiEnabled: boolean
}) {
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<AgentReply[]>([
    { role: "assistant", text: initialSummary },
  ])

  async function submit(text: string) {
    const clean = text.trim()
    if (!clean || loading) return

    setMessages((current) => [...current, { role: "user", text: clean }])
    setMessage("")
    setLoading(true)

    try {
      const response = await fetch("/api/admin/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean }),
      })
      const payload = (await response.json()) as {
        reply?: string
        error?: string
        mode?: "ai" | "fallback"
      }
      const reply = response.ok && payload.reply
        ? payload.reply
        : "აგენტმა პასუხი ვერ მიიღო. სცადე ხელახლა ან გადაამოწმე server logs."

      setMessages((current) => [...current, { role: "assistant", text: reply }])
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", text: "ქსელური შეცდომა დაფიქსირდა. სცადე ხელახლა." },
      ])
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit(message)
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="ui-card overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="ui-eyebrow">Read-only AI copilot</div>
              <h2 className="mt-2 text-2xl font-black text-text">SamoSell Admin Agent</h2>
            </div>
            <span className={
              aiEnabled
                ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
                : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900"
            }>
              {aiEnabled ? "AI READY" : "FALLBACK"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            აგენტი ყოველ კითხვაზე ახლიდან კითხულობს production snapshot-ს. ის ხედავს მხოლოდ
            ოპერაციულ მეტრიკებსა და system-generated signals-ს — Support message-ის ტექსტები,
            email-ები, private messages და secrets AI context-ში არ იგზავნება.
          </p>
        </div>

        <div className="max-h-[620px] min-h-[380px] space-y-4 overflow-y-auto bg-bg-soft/40 p-4 sm:p-6">
          {messages.map((item, index) => (
            <div
              key={`${item.role}-${index}`}
              className={item.role === "user" ? "ml-auto max-w-[88%]" : "mr-auto max-w-[94%]"}
            >
              <div
                className={
                  item.role === "user"
                    ? "rounded-[1.2rem] bg-primary px-4 py-3 text-sm leading-6 text-white"
                    : "whitespace-pre-wrap rounded-[1.2rem] border border-border bg-white px-4 py-3 text-sm leading-6 text-text"
                }
              >
                {item.text}
              </div>
            </div>
          ))}

          {loading ? (
            <div className="mr-auto max-w-[94%] rounded-[1.2rem] border border-border bg-white px-4 py-3 text-sm text-text-soft">
              production snapshot-ს ვაანალიზებ…
            </div>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="border-t border-border p-4 sm:p-5">
          <label htmlFor="admin-agent-message" className="sr-only">
            დავალება აგენტისთვის
          </label>
          <textarea
            id="admin-agent-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="მაგ: დღეს რომელი 3 საკითხი უნდა გადავხედო პირველ რიგში და სად?"
            rows={3}
            maxLength={4000}
            className="w-full resize-none rounded-[1.1rem] border border-border bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-text-soft">
              Phase 1: მხოლოდ ანალიზი და რეკომენდაციები — execution გამორთულია.
            </span>
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="ui-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              გაგზავნა
            </button>
          </div>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="ui-card p-5">
          <div className="ui-eyebrow">სწრაფი კითხვები</div>
          <div className="mt-4 space-y-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={loading}
                onClick={() => void submit(prompt)}
                className="w-full rounded-xl border border-border bg-white px-3 py-3 text-left text-sm font-semibold text-text transition hover:border-primary/40 hover:bg-bg-soft disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="ui-card p-5">
          <div className="ui-eyebrow">Phase 1 უფლებები</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-text-soft">
            <li>✓ კითხულობს ოპერაციულ მეტრიკებს.</li>
            <li>✓ ადგენს პრიორიტეტებს და checklist-ს.</li>
            <li>✓ გიჩვენებს რომელ Admin გვერდზე უნდა შეხვიდე.</li>
            <li>✕ არ შლის/მალავს განცხადებებს.</li>
            <li>✕ არ ბლოკავს მომხმარებლებს.</li>
            <li>✕ არ აკეთებს refund/payment approval-ს.</li>
            <li>✕ არ ცვლის DB-ს ან env/secrets-ს.</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
