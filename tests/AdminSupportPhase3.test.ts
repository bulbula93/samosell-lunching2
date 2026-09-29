import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260929105000_add_admin_support_ticketing.sql",
  ),
  "utf8",
)

const supportPage = readFileSync(
  join(process.cwd(), "app", "admin", "support", "page.tsx"),
  "utf8",
)

const supportActions = readFileSync(
  join(process.cwd(), "app", "admin", "support", "actions.ts"),
  "utf8",
)

const contactAction = readFileSync(
  join(process.cwd(), "app", "contact", "actions.ts"),
  "utf8",
)

const adminPage = readFileSync(
  join(process.cwd(), "app", "admin", "page.tsx"),
  "utf8",
)

const systemPage = readFileSync(
  join(process.cwd(), "app", "admin", "system", "page.tsx"),
  "utf8",
)

describe("admin phase 3 support ticketing", () => {
  it("creates durable support tickets with RLS and no direct client writes", () => {
    expect(migration).toContain("create table if not exists public.support_tickets")
    expect(migration).toContain("alter table public.support_tickets enable row level security")
    expect(migration).toContain("grant select on table public.support_tickets to authenticated")
    expect(migration).not.toContain("grant insert on table public.support_tickets to authenticated")
    expect(migration).not.toContain("grant update on table public.support_tickets to authenticated")
    expect(migration).toContain("(select auth.uid()) = user_id")
    expect(migration).toContain("(select public.is_current_user_admin())")
  })

  it("submits support through an authenticated-only RPC and prioritizes safety", () => {
    expect(migration).toContain("public.submit_support_ticket")
    expect(migration).toContain("v_actor uuid := auth.uid()")
    expect(migration).toContain("from auth.users")
    expect(migration).toContain("case when v_category = 'safety' then 'high' else 'normal' end")
    expect(migration).toContain(
      "revoke all on function public.submit_support_ticket(text, text, text)",
    )
    expect(migration).toContain(
      "grant execute on function public.submit_support_ticket(text, text, text)",
    )
  })

  it("keeps admin support transitions audited and server controlled", () => {
    expect(migration).toContain("public.admin_manage_support_ticket")
    expect(migration).toContain("public.is_current_user_admin()")
    expect(migration).toContain("'support.review'::text")
    expect(migration).toContain("'support.resolve'::text")
    expect(migration).toContain("'support.close'::text")
    expect(migration).toContain("'support.reopen'::text")
    expect(migration).toContain("target_support_ticket_id")
    expect(supportActions).toContain('supabase.rpc("admin_manage_support_ticket"')
    expect(supportPage).toContain("adminSupportTicketAction")
    expect(supportPage).not.toContain(".update(")
  })

  it("persists the support ticket before attempting email notification", () => {
    const persistAt = contactAction.indexOf('"submit_support_ticket"')
    const emailAt = contactAction.indexOf("const delivery = await sendTransactionalEmail")
    expect(persistAt).toBeGreaterThan(-1)
    expect(emailAt).toBeGreaterThan(persistAt)
    expect(contactAction).toContain("ticket stored but email notification failed")
    expect(contactAction).toContain("Support Inbox-ში შენახულია")
  })

  it("surfaces support in admin operations and system readiness", () => {
    expect(adminPage).toContain('href="/admin/support"')
    expect(adminPage).toContain('from("support_tickets")')
    expect(adminPage).toContain("Support მოთხოვნები")
    expect(systemPage).toContain('href: "/admin/support"')
    expect(systemPage).toContain("DB ticketing + email")
  })
})
