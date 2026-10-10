import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Read-only production data preview", () => {
  it("denies preview API, cron, callback and mutation requests at the proxy", () => {
    const proxy = readFileSync("proxy.ts", "utf8")
    expect(proxy).toContain("if (isReadOnlyPreview())")
    expect(proxy).toContain('pathname === "/"')
    expect(proxy).toContain('pathname.startsWith("/catalog/")')
    expect(proxy).toContain('pathname.startsWith("/listing/")')
    expect(proxy).toContain('["GET", "HEAD"].includes(request.method)')
    expect(proxy).toContain('error: "preview_read_only"')
    expect(proxy).not.toContain('pathname.startsWith("/api/") ||')
  })

  it("blocks Supabase write transport and keeps growth writes disabled", () => {
    const guard = readFileSync("lib/preview-read-only.ts", "utf8")
    const growth = readFileSync("lib/growth/server.ts", "utf8")
    expect(guard).toContain('!["GET", "HEAD", "OPTIONS"].includes(method)')
    expect(growth).toContain('process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true"')
  })
})
