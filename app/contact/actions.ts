"use server"

import { sendTransactionalEmail } from "@/lib/email"
import { enforceRateLimit } from "@/lib/rate-limit"
import { getSupportConfig } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"

export type SupportMessageResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

export type SupportMessageInput = {
  category: string
  subject: string
  message: string
}

const CATEGORY_LABELS: Record<string, string> = {
  account: "ანგარიში",
  listing: "განცხადება",
  chat: "ჩათი",
  technical: "ტექნიკური პრობლემა",
  safety: "უსაფრთხოება",
  other: "სხვა საკითხი",
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function cleanSubject(value: string) {
  return value.trim().replace(/[\r\n]+/g, " ")
}

export async function sendSupportMessageAction(
  input: SupportMessageInput,
): Promise<SupportMessageResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  const accountEmail = String(user?.email ?? "").trim().toLowerCase()
  if (userError || !user || !accountEmail) {
    return {
      ok: false,
      message: "მხარდაჭერასთან საიტიდან მოსაწერად ჯერ შედი ანგარიშში.",
    }
  }

  const categoryLabel = CATEGORY_LABELS[input.category]
  const subject = cleanSubject(String(input.subject ?? ""))
  const message = String(input.message ?? "").trim()

  if (!categoryLabel) {
    return { ok: false, message: "აირჩიე საკითხის ტიპი." }
  }
  if (subject.length < 3 || subject.length > 120) {
    return { ok: false, message: "სათაური უნდა იყოს 3-დან 120 სიმბოლომდე." }
  }
  if (message.length < 10 || message.length > 4000) {
    return { ok: false, message: "შეტყობინება უნდა იყოს 10-დან 4000 სიმბოლომდე." }
  }

  try {
    await enforceRateLimit(supabase, "support_contact")
  } catch (error) {
    const detail = error instanceof Error ? error.message : ""
    if (detail.startsWith("ძალიან ბევრი მოთხოვნა იყო:")) {
      return { ok: false, message: detail }
    }
    console.error("[support] rate limit check failed")
    return {
      ok: false,
      message: "შეტყობინება ახლა ვერ გაიგზავნა. სცადე ცოტა მოგვიანებით.",
    }
  }

  const support = getSupportConfig()
  const safeCategory = escapeHtml(categoryLabel)
  const safeSubject = escapeHtml(subject)
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br>")
  const safeEmail = escapeHtml(accountEmail)
  const safeUserId = escapeHtml(user.id)

  const delivery = await sendTransactionalEmail({
    to: support.supportEmail,
    replyTo: accountEmail,
    subject: `[SamoSell Support] ${categoryLabel} — ${subject}`,
    text: [
      "SamoSell მხარდაჭერის მოთხოვნა",
      "",
      `კატეგორია: ${categoryLabel}`,
      `ანგარიშის ელფოსტა: ${accountEmail}`,
      `User ID: ${user.id}`,
      `სათაური: ${subject}`,
      "",
      message,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#202124;line-height:1.6;max-width:680px">
        <div style="font-size:22px;font-weight:800;color:#0b6f63">SAMOSELL</div>
        <h2 style="margin:14px 0 6px;font-size:18px">ახალი მხარდაჭერის მოთხოვნა</h2>
        <table cellpadding="0" cellspacing="0" border="0" style="font-size:14px;margin:12px 0 18px">
          <tr><td style="padding:3px 14px 3px 0;color:#6b7280">კატეგორია</td><td><strong>${safeCategory}</strong></td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#6b7280">ელფოსტა</td><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#6b7280">User ID</td><td>${safeUserId}</td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#6b7280">სათაური</td><td><strong>${safeSubject}</strong></td></tr>
        </table>
        <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#fafafa;font-size:14px">${safeMessage}</div>
        <p style="margin-top:18px;font-size:12px;color:#6b7280">Reply-ზე დაჭერისას პასუხი ავტომატურად გაიგზავნება მომხმარებლის ანგარიშის ელფოსტაზე.</p>
      </div>
    `,
  })

  if (!delivery.ok) {
    return {
      ok: false,
      message: "შეტყობინება ახლა ვერ გაიგზავნა. სცადე ცოტა მოგვიანებით.",
    }
  }

  return {
    ok: true,
    message: `შეტყობინება გაიგზავნა. პასუხს მიიღებ ${accountEmail}-ზე.`,
  }
}
