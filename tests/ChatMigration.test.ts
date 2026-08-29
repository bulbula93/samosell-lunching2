import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260803212239_secure_buyer_seller_messaging.sql",
  ),
  "utf8",
)
const rateLimitMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260803212436_harden_action_rate_limit_arguments.sql",
  ),
  "utf8",
)
const rpcFixMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260803212805_fix_chat_message_body_rpc.sql",
  ),
  "utf8",
)
const chatViewPrivilegesMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260829120336_tighten_chat_threads_view_privileges.sql",
  ),
  "utf8",
)

describe("secure messaging migration", () => {
  it("fixes seller ownership and keeps duplicate conversations constrained", () => {
    expect(migration).toContain("l.seller_id = chats.seller_id")
    expect(migration).toContain(
      "on conflict (listing_id, buyer_id, seller_id) do nothing",
    )
    expect(migration).toContain("buyer_id <> seller_id")
  })

  it("creates one atomic first-message operation with database idempotency", () => {
    expect(migration).toContain("public.start_chat_with_message")
    expect(migration).toContain("messages_sender_request_unique_idx")
    expect(migration).toContain("p_client_request_id uuid")
    expect(migration).toContain("messages_body_length_check")
  })

  it("revokes broad browser writes and exposes only narrow authenticated RPCs", () => {
    expect(migration).toContain("revoke all on table public.chats from authenticated")
    expect(migration).toContain("revoke all on table public.messages from authenticated")
    expect(migration).toContain(
      "grant execute on function public.send_chat_message(uuid, text, uuid) to authenticated",
    )
    expect(migration).toContain("message = 'conversation_not_found'")
  })

  it("keeps history visible to prior participants without enabling a new sold CTA", () => {
    expect(migration).toContain("chat participants can read linked listings")
    expect(migration).toContain("l.status in ('active', 'reserved', 'sold')")
    expect(migration).toContain("l.status = 'active'")
  })

  it("pins DB-backed rate-limit arguments and removes the first-hit race", () => {
    expect(rateLimitMigration).toContain(
      "p_action = 'chat_message' and p_window_seconds = 60 and p_max_hits = 20",
    )
    expect(rateLimitMigration).toContain(
      "on conflict (user_id, action) do nothing",
    )
    expect(rateLimitMigration).toContain("bad_rate_limit_arguments")
  })

  it("keeps validated input separate from empty idempotency lookup results", () => {
    expect(rpcFixMigration).toContain("v_validated_body")
    expect(rpcFixMigration).toContain("v_result_body")
    expect(rpcFixMigration).toContain(
      "values (\n    v_chat_id,\n    v_buyer_id,\n    v_validated_body,",
    )
  })

  it("keeps the participant inbox view read-only for API roles", () => {
    expect(chatViewPrivilegesMigration).toContain(
      "revoke all on table public.chat_threads from anon, authenticated",
    )
    expect(chatViewPrivilegesMigration).toContain(
      "grant select on table public.chat_threads to authenticated",
    )
  })
})
