import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  buildFallbackAdminSummary,
  type AdminAgentSnapshot,
} from "@/lib/admin-agent"

const snapshotSource = readFileSync(
  join(process.cwd(), "lib", "admin-agent.ts"),
  "utf8",
)
const routeSource = readFileSync(
  join(process.cwd(), "app", "api", "admin", "agent", "route.ts"),
  "utf8",
)
const pageSource = readFileSync(
  join(process.cwd(), "app", "admin", "agent", "page.tsx"),
  "utf8",
)
const clientSource = readFileSync(
  join(process.cwd(), "components", "admin", "AdminAgentClient.tsx"),
  "utf8",
)

function sampleSnapshot(): AdminAgentSnapshot {
  return {
    generatedAt: "2026-09-29T13:00:00.000Z",
    activeListings: 10,
    suspendedUsers: 1,
    activeBoosts: 2,
    openListingReports: 2,
    openUserReports: 1,
    reviewingListingReports: 1,
    reviewingUserReports: 0,
    overdueReports24h: 2,
    openSupportTickets: 3,
    reviewingSupportTickets: 1,
    highPrioritySupportTickets: 1,
    overdueSupportTickets24h: 1,
    realLivePayments: 4,
    approvedPayments: 3,
    pendingPayments: 1,
    stalePendingPayments: 1,
    failedPayments: 0,
    returnedPayments: 0,
    validationPayments: 4,
    totalStores: 2,
    verifiedStores: 1,
    incompleteStores: 1,
    suspendedStores: 0,
    signals: [],
  }
}

describe("Admin Agent Phase 1", () => {
  it("uses privacy-minimized operational fields instead of private message bodies", () => {
    expect(snapshotSource).toContain(
      '.select("id, category, status, priority, created_at")',
    )
    expect(snapshotSource).toContain(
      '.select("id, status, created_at")',
    )
    expect(snapshotSource).not.toContain("account_email")
    expect(snapshotSource).not.toContain("support_tickets\").select(\"message")
    expect(snapshotSource).not.toContain("details,")
    expect(snapshotSource).not.toContain("moderation_note")
  })

  it("separates real Flitt payments from validation attempts", () => {
    expect(snapshotSource).toContain('.neq("purpose", "sandbox_test")')
    expect(snapshotSource).toContain('.eq("purpose", "sandbox_test")')
    expect(snapshotSource).toContain("PAYMENT_STALE_MINUTES = 30")
    expect(routeSource).toContain(
      "Validation payments are tests and must not be described as real customer payment incidents.",
    )
  })

  it("keeps the AI route admin-only and read-only", () => {
    expect(routeSource).toContain('requireAdminUser("/dashboard")')
    expect(routeSource).toContain("You are READ-ONLY")
    expect(routeSource).toContain("You have no execution tools")
    expect(routeSource).not.toContain(".update(")
    expect(routeSource).not.toContain(".insert(")
    expect(routeSource).not.toContain(".delete(")
    expect(routeSource).not.toContain(".rpc(")
  })

  it("uses the current balanced OpenAI model by default without exposing the key", () => {
    expect(routeSource).toContain('"gpt-5.6-terra"')
    expect(routeSource).toContain("process.env.OPENAI_API_KEY")
    expect(routeSource).toContain("https://api.openai.com/v1/responses")
    expect(routeSource).not.toContain("NEXT_PUBLIC_OPENAI")
    expect(pageSource).not.toContain("process.env.OPENAI_API_KEY ?? \"")
  })

  it("shows live priorities and Phase 1 safety state in the UI", () => {
    expect(pageSource).toContain("Live priorities")
    expect(pageSource).toContain("snapshot.signals")
    expect(pageSource).toContain("AI mode: READY")
    expect(clientSource).toContain("Phase 1: მხოლოდ ანალიზი და რეკომენდაციები")
    expect(clientSource).toContain("private messages და secrets AI context-ში არ იგზავნება")
  })

  it("builds a deterministic fallback summary from the live snapshot", () => {
    const summary = buildFallbackAdminSummary(sampleSnapshot())
    expect(summary).toContain("Flitt რეალური LIVE: 4")
    expect(summary).toContain("1 რეალური Flitt გადახდა 30 წუთზე მეტია")
    expect(summary).toContain("1 მაღალი პრიორიტეტის ticket")
    expect(summary).toContain("2 რეპორტი 24 საათზე მეტია")
    expect(summary).toContain("Phase 1 მხოლოდ კითხულობს მონაცემებს")
  })
})
