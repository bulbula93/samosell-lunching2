import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const agentLib = readFileSync(
  join(process.cwd(), "lib", "admin-agent.ts"),
  "utf8",
)
const agentRoute = readFileSync(
  join(process.cwd(), "app", "api", "admin", "agent", "route.ts"),
  "utf8",
)
const agentPage = readFileSync(
  join(process.cwd(), "app", "admin", "agent", "page.tsx"),
  "utf8",
)
const agentClient = readFileSync(
  join(process.cwd(), "components", "admin", "AdminAgentClient.tsx"),
  "utf8",
)
const systemPage = readFileSync(
  join(process.cwd(), "app", "admin", "system", "page.tsx"),
  "utf8",
)

describe("Admin AI Copilot Phase 1", () => {
  it("builds a broad read-only operations snapshot", () => {
    expect(agentLib).toContain('from("flitt_payment_attempts")')
    expect(agentLib).toContain('from("support_tickets")')
    expect(agentLib).toContain('from("listing_reports")')
    expect(agentLib).toContain('from("user_reports")')
    expect(agentLib).toContain('from("story_reports")')
    expect(agentLib).toContain('from("ads")')
    expect(agentLib).toContain('eq("seller_type", "store")')
    expect(agentLib).toContain("stalePendingPayments")
    expect(agentLib).toContain("overdueReports")
    expect(agentLib).toContain("highPrioritySupportTickets")
    expect(agentLib).toContain("buildSignals")
  })

  it("keeps sensitive support/report content out of the model context", () => {
    expect(agentLib).toContain(
      '.select("id, category, status, priority, created_at, updated_at")',
    )
    expect(agentLib).not.toContain(
      '.select("id, account_email, category, subject, message',
    )
    expect(agentLib).not.toContain(
      '.select("id, status, reason, details, created_at")',
    )
    expect(agentLib).toContain(
      "Context intentionally excludes emails, support message bodies, report details",
    )
    expect(agentRoute).toContain("buildAdminAgentModelContext(snapshot)")
    expect(agentRoute).not.toContain("JSON.stringify(snapshot")
    expect(agentRoute).not.toContain("snapshot,")
  })

  it("keeps the AI route admin-only and strictly read-only", () => {
    expect(agentRoute).toContain('requireAdminUser("/dashboard")')
    expect(agentRoute).toContain("You cannot execute changes in Phase 1")
    expect(agentRoute).toContain("READ-ONLY")
    expect(agentRoute).not.toContain(".update(")
    expect(agentRoute).not.toContain(".insert(")
    expect(agentRoute).not.toContain(".delete(")
    expect(agentRoute).not.toContain(".rpc(")
  })

  it("caps conversation history and does not log raw OpenAI error bodies", () => {
    expect(agentRoute).toContain("MAX_HISTORY_ITEMS = 8")
    expect(agentRoute).toContain("MAX_HISTORY_CHARS = 1600")
    expect(agentRoute).toContain("sanitizeHistory")
    expect(agentRoute).toContain("AbortSignal.timeout(20_000)")
    expect(agentRoute).toContain('response.headers.get("x-request-id")')
    expect(agentRoute).not.toContain("await response.text()")
  })

  it("shows deterministic priority signals and AI readiness in the admin UI", () => {
    expect(agentPage).toContain("Live priority engine")
    expect(agentPage).toContain("snapshot.signals")
    expect(agentPage).toContain("AI API READY")
    expect(agentPage).toContain("DATA HEALTH OK")
    expect(agentPage).toContain("FLITT READY")
    expect(systemPage).toContain("Admin AI Copilot")
    expect(systemPage).toContain('envPresent("OPENAI_API_KEY")')
    expect(systemPage).not.toContain("process.env.OPENAI_API_KEY")
  })

  it("sends bounded chat history and clearly exposes AI vs fallback mode", () => {
    expect(agentClient).toContain("messages")
    expect(agentClient).toContain(".slice(-8)")
    expect(agentClient).toContain("JSON.stringify({ message: clean, history })")
    expect(agentClient).toContain("AI CONNECTED")
    expect(agentClient).toContain("DETERMINISTIC FALLBACK")
    expect(agentClient).toContain("private content")
  })
})
