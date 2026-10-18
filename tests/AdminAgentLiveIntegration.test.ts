// @vitest-environment node
// Explicit opt-in; six paid requests with synthetic data only. No DB imports.
import { afterAll, describe, expect, it, vi } from "vitest"
import { invokeAdminAgent } from "@/lib/admin-agent-provider"

const enabled = process.env.ADMIN_AGENT_LIVE_TEST === "true"
const scenarios = [
  { name: "priorities", message: "დაალაგე ადმინისტრაციული პრიორიტეტები. არ შეასრულო ცვლილებები.", context: { moderation: { open: 12, overdue24h: 3 }, payments: { stale30m: 2, failedRefunds: 1 }, dataHealth: { ok: true } } },
  { name: "moderation", message: "შეაჯამე მოდერაციის backlog და უსაფრთხო შემდეგი ნაბიჯი.", context: { moderation: { open: 12, reviewing: 4, overdue24h: 3 }, nextScreen: "/admin/reports", dataHealth: { ok: true } } },
  { name: "payments-system", message: "შეაჯამე Payments/System Health. გამოყავი ფაქტები რეკომენდაციებისგან.", context: { payments: { live: 10, approved: 7, pending: 2, stale30m: 1, failed: 1, validation: 3 }, system: { transactionalEmailReady: false }, dataHealth: { ok: false, failedSections: ["ads"] } } },
]

afterAll(() => vi.unstubAllEnvs())
describe.skipIf(!enabled)("Live OpenAI vs Muse benchmark — synthetic fixtures", () => {
  for (const provider of ["openai", "muse-spark"] as const) {
    for (const scenario of scenarios) {
      it(`${provider}: ${scenario.name}`, async () => {
        if (!process.env.OPENAI_API_KEY || !process.env.OPENROUTER_API_KEY || process.env.MUSE_SPARK_MODEL !== "meta/muse-spark-open") {
          throw new Error("Live gate requires both server-only API keys and the verified Muse model")
        }
        vi.stubEnv("ADMIN_AGENT_PROVIDER", provider)
        const result = await invokeAdminAgent({
          systemPrompt: "You are SamoSell Admin Copilot. Respond briefly in Georgian. Use only provided synthetic facts; acknowledge partial data. Read-only: no actions, secrets or personal data. Payment validation attempts are not real incidents. Recommend admin review before any changes.",
          context: scenario.context, conversation: [], message: scenario.message,
        })
        console.info(JSON.stringify({ provider, scenario: scenario.name, latencyMs: result.latencyMs, failure: result.failure, reply: result.reply }))
        expect(result.failure).toBeNull()
        expect(result.requestedProvider).toBe(provider)
        expect(result.reply).toMatch(/[ა-ჰ]/)
        expect(result.latencyMs).toBeLessThan(20_500)
        // Accuracy and Georgian quality still require human review of these synthetic replies.
      }, 25_000)
    }
  }
})
