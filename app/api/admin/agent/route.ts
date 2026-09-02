import { NextResponse } from "next/server"
import { requireAdminUser } from "@/lib/auth"
import { buildFallbackAdminSummary, collectAdminAgentSnapshot } from "@/lib/admin-agent"

const SYSTEM_PROMPT = `You are the SamoSell Admin Agent, a read-only operational copilot for the marketplace administrator.
Respond in Georgian unless the administrator writes in another language.
Use only the supplied live admin snapshot as factual operational data.
Be concise, prioritize issues, and separate facts from recommendations.
Never claim that you changed, deleted, suspended, approved, paid, deployed, or otherwise executed anything.
You are READ-ONLY in v1. If the administrator asks you to take an action, explain the proposed action and say that execution requires an explicit approval-enabled tool in a later phase.
Never expose secrets, tokens, service-role keys, private messages, or personal user data.`

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""
  const record = payload as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
  return (record.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text ?? "")
    .join("\n")
    .trim()
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdminUser("/dashboard")
    const body = (await request.json().catch(() => ({}))) as { message?: unknown }
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : ""

    if (!message) {
      return NextResponse.json({ error: "message_required" }, { status: 400 })
    }

    const snapshot = await collectAdminAgentSnapshot(supabase)
    const fallback = buildFallbackAdminSummary(snapshot)
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        mode: "fallback",
        reply: `${fallback}\n\nAI რეჟიმის ჩასართავად production environment-ში დაამატე OPENAI_API_KEY.`,
        snapshot,
      })
    }

    const model = process.env.ADMIN_AGENT_MODEL || "gpt-5.6-terra"
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        input: [
          { role: "developer", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `LIVE ADMIN SNAPSHOT:\n${JSON.stringify(snapshot, null, 2)}\n\nADMIN REQUEST:\n${message}`,
          },
        ],
        max_output_tokens: 900,
      }),
      cache: "no-store",
    })

    if (!response.ok) {
      console.error("admin_agent_openai_error", response.status, await response.text())
      return NextResponse.json({ mode: "fallback", reply: fallback, snapshot }, { status: 200 })
    }

    const payload = await response.json()
    const reply = extractResponseText(payload) || fallback

    return NextResponse.json({ mode: "ai", reply, snapshot })
  } catch (error) {
    console.error("admin_agent_error", error)
    return NextResponse.json({ error: "admin_agent_failed" }, { status: 500 })
  }
}
