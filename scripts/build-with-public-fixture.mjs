// CI must build ISR without reaching Production or a placeholder internet host.
import { createPublicCacheFixture } from "./public-cache-fixture.mjs"
import { once } from "node:events"
import { spawn } from "node:child_process"
import { resolve } from "node:path"

await import("./ai-ops-preview-prebuild.mjs")
await import("./clean-next-cache.mjs")
const fixture = createPublicCacheFixture()
fixture.listen(0, "127.0.0.1")
await once(fixture, "listening")
try {
  const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "build", "--webpack"], {
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixture.address().port}`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "ci-anonymous-public-fixture", NEXT_PUBLIC_PREVIEW_READ_ONLY: "false",
      NEXT_TELEMETRY_DISABLED: "1" },
  })
  const [code] = await once(child, "exit")
  if (code !== 0) process.exitCode = code ?? 1
} finally { fixture.close() }
