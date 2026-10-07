"use client"

import { FormEvent, useState } from "react"

type ReplySource = "snapshot" | "ai" | "fallback"

type AgentReply = {
  role: "user" | "assistant"
  text: string
  source?: ReplySource
}

const QUICK_PROMPTS = [
  "დღეს რა growth bottleneck გვაქვს?",
  "როგორ მივიყვანოთ warm seller-ები მესამე განცხადებამდე?",
  "შემიქმენი 3 Instagram/TikTok hook seller acquisition-ისთვის",
  "Founding Sellers კამპანიის მექანიკა შემომთავაზე",
  "შემომთავაზე 7-დღიანი ექსპერიმენტი ზუსტი KPI-ებით",
]

function sourceLabel(source?: ReplySource) {
  if (source === "ai") return "AI"
  if (source === "fallback") return "Fallback"
  if (source === "snapshot") return "Live snapshot"
  return ""
}

export default function GrowthAgentClient({
  initialSummary,
  aiConfigured,
  generatedAt,
}: {
  initialSummary: string
  aiConfigured: boolean
  generatedAt: string
}) {
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"ai" | "fallback">(
    aiConfigured ? "ai" : "fallback",
  )
  const [messages, setMessages] = useState<AgentReply[]>([
    { role: "assistant", text: initialSummary, source: "snapshot" },
  ])

  async function submit(text: string) {
    const clean = text.trim()
    if (!clean || loading) return

    const history = messages
      .slice(-8)
      .map((item) => ({ role: item.role, text: item.text }))

    setMessages((current) => [...current, { role: "user", text: clean }])
    setMessage("")
    setLoading(true)

    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, history }),
      })

      const payload = (await response.json()) as {
        reply?: string
        mode?: "ai" | "fallback"
      }

      const reply =
        response.ok && payload.reply
          ? payload.reply
          : "Growth Agent-მა პასუხი ვერ მიიღო. გადაამოწმე System Status."

      const replyMode = payload.mode === "ai" ? "ai" : "fallback"
      setMode(replyMode)
      setMessages((current) => [
        ...current,
        { role: "assistant", text: reply, source: replyMode },
      ])
    } catch {
      setMode("fallback")
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "ქსელური შეცდომა დაფიქსირდა. სცადე ხელახლა.",
          source: "fallback",
        },
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="ui-card overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="ui-eyebrow">Seller acquisition copilot</div>
              <h2 className="mt-2 text-2xl font-black text-text">
                SamoSell Growth Agent
              </h2>
            </div>
            <span
              className={
                mode === "ai"
                  ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
                  : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900"
              }
            >
              {mode === "ai" ? "AI CONNECTED" : "DETERMINISTIC FALLBACK"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            ყოველ კითხვაზე თავიდან კითხულობს aggregate growth snapshot-ს.
            ამ ფაზაში კამპანიებს გეგმავს და ტექსტებს ამზადებს, მაგრამ თვითონ
            არ აქვეყნებს, არ აგზავნის DM-ს და არ ხარჯავს ბიუჯეტს.
          </p>
        </div>

        <div
          className="max-h-[600px] min-h-[390px] space-y-4 overflow-y-auto bg-bg-soft/40 p-4 sm:p-6"
          aria-live="polite"
        >
          {messages.map((item, index) => (
            <div
              key={item.role + "-" + index}
              className={
                item.role === "user"
                  ? "ml-auto max-w-[88%]"
                  : "mr-auto max-w-[94%]"
              }
            >
              {item.role === "assistant" && item.source ? (
                <div className="mb-1 ml-1 text-[11px] font-bold uppercase tracking-wide text-text-soft">
                  {sourceLabel(item.source)}
                </div>
              ) : null}
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
              ვკითხულობ ახალ growth snapshot-ს და ვაანალიზებ…
            </div>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="border-t border-border p-4 sm:p-5">
          <label htmlFor="growth-agent-message" className="sr-only">
            დავალება Growth Agent-ს
          </label>
          <textarea
            id="growth-agent-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="მაგ: მომიმზადე ხვალისთვის seller acquisition კამპანია 20₾ ბიუჯეტისთვის"
            rows={3}
            maxLength={4000}
            className="w-full resize-none rounded-[1.1rem] border border-border bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs leading-5 text-text-soft">
              Agent context-ში მხოლოდ aggregate KPI-ებია — არა პირადი მონაცემები.
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
          <div className="ui-eyebrow">სწრაფი დავალებები</div>
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
          <div className="ui-eyebrow">Mode</div>
          <div className="mt-3 text-sm font-bold text-text">
            {aiConfigured
              ? "OpenAI Responses API configured"
              : "Fallback mode — OPENAI_API_KEY აკლია"}
          </div>
          <p className="mt-2 text-xs leading-5 text-text-soft">
            Snapshot:{" "}
            {new Intl.DateTimeFormat("ka-GE", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(generatedAt))}
          </p>
        </div>

        <div className="ui-card p-5">
          <div className="ui-eyebrow">ავტონომიის საზღვარი v1</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-text-soft">
            <li>• KPI-ებს თვითონ კითხულობს.</li>
            <li>• კამპანიებს და კონტენტს თვითონ გეგმავს.</li>
            <li>• Meta/TikTok-ზე ჯერ არ აქვეყნებს.</li>
            <li>• რეკლამის ბიუჯეტს ჯერ არ ცვლის.</li>
            <li>• მასობრივ DM-ს არ აგზავნის.</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
