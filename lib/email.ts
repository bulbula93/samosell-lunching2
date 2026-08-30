import { getSiteUrlEnv } from "@/lib/env"

type SendEmailInput = {
  to: string
  subject: string
  text: string
  html: string
}

export type SendEmailResult =
  | { ok: true }
  | { ok: false; skipped: true }
  | { ok: false; skipped: false; status?: number }

function getEmailConfig() {
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim()
  const from = String(
    process.env.NOTIFICATION_EMAIL_FROM ?? process.env.EMAIL_FROM ?? "",
  ).trim()

  if (!apiKey || !from) return null
  return { apiKey, from }
}

export function absoluteSiteUrl(path: string) {
  const safePath = path.startsWith("/") ? path : `/${path}`
  return `${getSiteUrlEnv()}${safePath}`
}

export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const config = getEmailConfig()
  if (!config) return { ok: false, skipped: true }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      signal: AbortSignal.timeout(6000),
    })

    if (!response.ok) {
      console.error(`[email] delivery failed with status ${response.status}`)
      return { ok: false, skipped: false, status: response.status }
    }

    return { ok: true }
  } catch (error) {
    console.error("[email] delivery request failed", error instanceof Error ? error.message : "unknown error")
    return { ok: false, skipped: false }
  }
}
