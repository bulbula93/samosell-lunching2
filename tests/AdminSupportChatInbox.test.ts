import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const migration = readFileSync(
  join(root, "supabase/migrations/20261007072000_add_admin_support_chat_inbox.sql"),
  "utf8",
)
const inbox = readFileSync(join(root, "app/admin/support/chats/page.tsx"), "utf8")
const thread = readFileSync(
  join(root, "app/admin/support/chats/[chatId]/page.tsx"),
  "utf8",
)
const actions = readFileSync(
  join(root, "app/admin/support/chats/actions.ts"),
  "utf8",
)

describe("admin support chat inbox", () => {
  it("keeps ordinary chats private while granting admins support-only read access", () => {
    expect(migration).toContain('chat_type = \'support\'')
    expect(migration).toContain('"admins can read support chats"')
    expect(migration).toContain('"admins can read support messages"')
    expect(migration).toContain("p.is_admin")
    expect(migration).toContain("not p.is_suspended")
  })

  it("uses a shared support read cursor and an admin-only reply RPC", () => {
    expect(migration).toContain("seller_last_read_at = clock_timestamp()")
    expect(migration).toContain("admin_mark_support_chat_read")
    expect(migration).toContain("admin_send_support_message")
    expect(migration).toContain("revoke all on function public.admin_send_support_message")
    expect(migration).toContain("grant execute on function public.admin_send_support_message")
  })

  it("routes all support conversations into one admin inbox", () => {
    expect(inbox).toContain('.eq("chat_type", "support")')
    expect(inbox).toContain("პასუხს ელოდება")
    expect(thread).toContain("AdminSupportChatClient")
    expect(actions).toContain("SamoSell Help:")
    expect(actions).toContain("/dashboard/chats/")
  })
})
