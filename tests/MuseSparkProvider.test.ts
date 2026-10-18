import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const provider = readFileSync(join(process.cwd(), "lib/muse-spark-provider.ts"), "utf8")
const route = readFileSync(join(process.cwd(), "app/api/admin/agent/route.ts"), "utf8")

describe("Muse Spark optional provider wiring", () => {
  it("keeps the admin auth and default OpenAI path", () => {
    expect(route).toContain('requireAdminUser("/dashboard")')
    expect(route).toContain('process.env.ADMIN_AGENT_PROVIDER === "muse-spark"')
    expect(route).toContain('https://api.openai.com/v1/responses')
  })
  it("keeps secrets server-side and provider failures deterministic", () => {
    expect(provider).toContain('import "server-only"')
    expect(provider).toContain("AbortSignal.timeout(20_000)")
    expect(provider).toContain("if (!model || !input.apiKey) return null")
    expect(provider).not.toContain("NEXT_PUBLIC_")
    expect(route).toContain('reply: reply || fallback')
  })
  it("keeps Muse read-only and forwards only bounded admin context", () => {
    expect(route).toContain("buildAdminAgentModelContext(snapshot)")
    expect(provider).toContain("CURRENT READ-ONLY ADMIN CONTEXT")
    expect(provider).not.toContain(".insert(")
    expect(provider).not.toContain(".update(")
    expect(provider).not.toContain(".delete(")
  })
})
