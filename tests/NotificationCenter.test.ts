import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const migration = read("supabase/migrations/20260830220928_add_notification_center.sql")
const chatActions = read("app/dashboard/chats/actions.ts")
const notificationService = read("lib/notifications.ts")
const siteHeader = read("components/layout/SiteHeader.tsx")

describe("notification center", () => {
  it("keeps notification writes server-only while users can read their own rows", () => {
    expect(migration).toContain("revoke all on table public.notifications from public, anon, authenticated")
    expect(migration).toContain("grant select on table public.notifications to authenticated")
    expect(migration).toContain("using (user_id = auth.uid())")
  })

  it("uses scoped RPCs for read-state changes", () => {
    expect(migration).toContain("mark_notification_read")
    expect(migration).toContain("mark_all_notifications_read")
    expect(migration).toContain("mark_chat_notifications_read")
    expect(migration).toContain("user_id = auth.uid()")
  })

  it("creates idempotent chat notifications and only emails the first buyer message", () => {
    expect(notificationService).toContain("event_key: `chat_message:${input.messageId}`")
    expect(notificationService).toContain("insertError.code === \"23505\"")
    expect(notificationService).toContain("input.firstMessage && input.senderId === chat.buyer_id")
    expect(notificationService).toContain("sendFirstChatEmail")
  })

  it("wires notification creation to both chat message flows", () => {
    expect(chatActions).toContain("firstMessage: true")
    expect(chatActions).toContain("firstMessage: false")
    expect(chatActions).toContain("mark_chat_notifications_read")
  })

  it("shows an unread notification count in the global header", () => {
    expect(siteHeader).toContain('.from("notifications")')
    expect(siteHeader).toContain("unreadNotifications")
  })
})
