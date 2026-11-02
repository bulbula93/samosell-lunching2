// @vitest-environment node
import { spawnSync } from "node:child_process"
import { expect, it } from "vitest"
const run = (overrides: Record<string, string>) => spawnSync(process.execPath, ["scripts/cpu-preview-guard.mjs"], { env: { NODE_ENV: "test", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "preview/cpu-optimization-20261102", NEXT_PUBLIC_SUPABASE_URL: "https://ydocqjdjmffysexkzxyc.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture", NEXT_PUBLIC_PREVIEW_READ_ONLY: "true", ...overrides }, encoding: "utf8" })
it("fails before a Preview build can use a Production target or privileged credential", () => {
  expect(run({ NEXT_PUBLIC_SUPABASE_URL: "https://lxsvjzbiuewgwpajqrwr.supabase.co" }).status).toBe(1)
  expect(run({ SUPABASE_SERVICE_ROLE_KEY: "privileged-fixture" }).status).toBe(1)
  expect(run({}).status).toBe(0)
})
it("does not change Production or unrelated branches", () => {
  expect(run({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "unchanged" }).status).toBe(0)
  expect(run({ VERCEL_GIT_COMMIT_REF: "another-branch", NEXT_PUBLIC_SUPABASE_URL: "unchanged" }).status).toBe(0)
})
