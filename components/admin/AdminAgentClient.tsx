"use client"

import { FormEvent, useState } from "react"

type AgentReply = {
  role: "user" | "assistant"
  text: string
}

const QUICK_PROMPTS = [
  "დღეს რა არის ყველაზე პრიორიტეტული?",
  "მოდერაციის მდგომარეობა შემაჯამე",
  "VIP მოთხოვნებში რამე საყურადღებოა?",
  "შემომთავაზე დღევანდელი admin checklist",
]

export default function AdminAgentClient({ initialSummary }: { initialSummary: string }) {
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
      const payload = (await response.json()) as { reply?: string; error?: string }
      const reply = response.ok && payload.reply
        ? payload.reply
        : "აგენტმა პასუხი ვერ მიიღო. სცადე ხელახლა ან გადაამოწმე server logs."
      setMessages((current) => [...current, { role: "assistant", text: reply }])
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "ქსელური შეცდომა დაფიქსირდა. სცადე ხელახლა." }])
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit(message)
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="ui-card overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <div className="ui-eyebrow">Read-only AI copilot</div>
          <h2 className="mt-2 text-2xl font-black text-text">SamoSell Admin Agent</h2>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            აგენტი კითხულობს მხოლოდ ადმინისტრაციულ snapshot-ს, გაძლევს პრიორიტეტებს და რეკომენდაციებს. ამ ვერსიაში თვითონ არაფერს ცვლის.
          </p>
        </div>

        <div className="max-h-[560px] min-h-[360px] space-y-4 overflow-y-auto bg-bg-soft/40 p-4 sm:p-6">
          {messages.map((item, index) => (
            <div key={`${item.role}-${index}`} className={item.role === "user" ? "ml-auto max-w-[88%]" : "mr-auto max-w-[92%]"}>
              <div className={item.role === "user"
                ? "rounded-[1.2rem] bg-primary px-4 py-3 text-sm leading-6 text-white"
                : "rounded-[1.2rem] border border-border bg-white px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-text"}>
                {item.text}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="mr-auto max-w-[92%] rounded-[1.2rem] border border-border bg-white px-4 py-3 text-sm text-text-soft">
              ვაანალიზებ მიმდინარე მონაცემებს…
            </div>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="border-t border-border p-4 sm:p-5">
          <label htmlFor="admin-agent-message" className="sr-only">დავალება აგენტისთვის</label>
          <textarea
            id="admin-agent-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="მაგ: დღეს რა უნდა გადავხედო პირველ რიგში?"
            rows={3}
            maxLength={4000}
            className="w-full resize-none rounded-[1.1rem] border border-border bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-text-soft">Sensitive/private data არ იგზავნება agent snapshot-ში.</span>
            <button type="submit" disabled={loading || !message.trim()} className="ui-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
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
          <div className="ui-eyebrow">უსაფრთხოება</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-text-soft">
            <li>• არ შლის განცხადებებს.</li>
            <li>• არ ბლოკავს მომხმარებლებს.</li>
            <li>• არ ამტკიცებს გადახდებს.</li>
            <li>• არ ცვლის ფასებს ან private data-ს.</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
