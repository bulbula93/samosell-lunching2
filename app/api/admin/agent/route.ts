import { NextResponse } from "next/server"
import { requireAdminUser } from "@/lib/auth"
import {
  buildFallbackAdminSummary,
  collectAdminAgentSnapshot,
} from "@/lib/admin-agent"

const SYSTEM_PROMPT = `You are the SamoSell Admin Copilot for the marketplace administrator.

MODE AND AUTHORITY
- You are READ-ONLY.
- You can analyze, prioritize, explain, and recommend.
- You have no execution tools and must never claim that you changed anything.
- Never claim to hide/restore listings, suspend users, verify sellers, resolve tickets, approve/refund payments, change configuration, deploy code, or mutate a database.
- If the administrator asks you to execute an action, explain what should be done and point to the relevant admin area. State that Phase 1 requires the human administrator to perform or approve the action.

DATA RULES
- Treat LIVE ADMIN SNAPSHOT as the only factual source for current SamoSell operational state.
- The snapshot is deliberately privacy-minimized: it contains counts, statuses, ages, IDs, and system-generated signals. It does not contain support message bodies, emails, private chat messages, passwords, keys, or payment-card data.
- Never infer personal details that are not in the snapshot.
- Never ask for or expose secrets/API keys.
- Validation payments are tests and must not be described as real customer payment incidents.
- For Flitt payments, distinguish pending/processing from approved. response_status=success by itself is not payment approval.

ANSWER STYLE
- Respond in Georgian unless the administrator explicitly uses another language.
- Be concise and operational.
- Start with the direct answer.
- When priorities exist, order them by severity and age.
- Cite entity IDs from the snapshot when that helps the administrator find the item.
- Give the exact relevant SamoSell admin path when useful, for example /admin/payments, /admin/reports, /admin/support, /admin/stores.
- Separate observed facts from recommendations.
- If the snapshot does not support a conclusion, say that it is not visible in the current read-only data.
`

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""
  const record = payload as {
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
  }

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
    const body = (await request.json().catch(() => ({}))) as {
      message?: unknown
    }
    const message =
      typeof body.message === "string"
        ? body.message.trim().slice(0, 4000)
        : ""

    if (!message) {
      return NextResponse.json({ error: "message_required" }, { status: 400 })
    }

    const snapshot = await collectAdminAgentSnapshot(supabase)
    const fallback = buildFallbackAdminSummary(snapshot)
    const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim()

    if (!apiKey) {
      return NextResponse.json({
        mode: "fallback",
        reply: [
          fallback,
          "",
          "AI reasoning ახლა გამორთულია, რადგან server-side OPENAI_API_KEY configured არ არის.",
        ].join("\n"),
      })
    }

    const model = String(process.env.ADMIN_AGENT_MODEL || "gpt-5.6-terra").trim()

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
            content: [
              "LIVE ADMIN SNAPSHOT (privacy-minimized, read-only):",
              JSON.stringify(snapshot, null, 2),
              "",
              "ADMIN REQUEST:",
              message,
            ].join("\n"),
          },
        ],
        max_output_tokens: 1200,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) {
      console.error("admin_agent_openai_error", {
        status: response.status,
        model,
      })
      return NextResponse.json({
        mode: "fallback",
        reply: [
          fallback,
          "",
          "AI პასუხი დროებით ვერ მივიღე; ზემოთ მოცემული deterministic snapshot summary აქტუალურია.",
        ].join("\n"),
      })
    }

    const payload = await response.json()
    const reply = extractResponseText(payload) || fallback

    return NextResponse.json({
      mode: "ai",
      reply,
    })
  } catch (error) {
    console.error("admin_agent_error", {
      message: error instanceof Error ? error.message : "unknown_error",
    })
    return NextResponse.json({ error: "admin_agent_failed" }, { status: 500 })
  }
}
