import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { chatDisplayName, isSupportChatForUser } from "@/lib/chats"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006145000_add_welcome_support_chat.sql",
  ),
  "utf8",
)

describe("welcome support chat", () => {
  it("keeps support distinct from ordinary direct chats", () => {
    expect(migration).toContain("chat_type in ('direct', 'support')")
    expect(migration).toContain("chats_support_buyer_unique_idx")
    expect(migration).toContain("where chat_type = 'support'")
  })

  it("creates one welcome thread after profile creation without risking signup", () => {
    expect(migration).toContain("profiles_create_welcome_support_chat")
    expect(migration).toContain("after insert on public.profiles")
    expect(migration).toContain("exception")
    expect(migration).toContain("when others then")
    expect(migration).toContain("welcome support chat skipped")
  })

  it("creates an unread chat notification for discoverability", () => {
    expect(migration).toContain("'chat_message'")
    expect(migration).toContain("'support_welcome:' || new.id::text")
    expect(migration).toContain("'official_support', true")
  })

  it("keeps support replyable with text and screenshot messages", () => {
    expect(migration).toContain("v_chat_type not in ('listing', 'direct', 'support')")
    expect(migration).toContain("v_chat_type not in ('listing','direct','support')")
    expect(migration).toContain("send_chat_image_message")
  })

  it("shows the official identity only to the support recipient", () => {
    const userThread = {
      chat_type: "support",
      buyer_id: "user-1",
      counterparty_full_name: "Admin Person",
      counterparty_username: "admin",
    }
    expect(isSupportChatForUser(userThread, "user-1")).toBe(true)
    expect(chatDisplayName(userThread, "user-1")).toBe("SamoSell Help")
    expect(chatDisplayName(userThread, "admin-1")).toBe("Admin Person")
  })
})
