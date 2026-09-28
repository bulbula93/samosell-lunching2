import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("Vercel Git deployment policy", () => {
  it("deploys main automatically while keeping work branches quiet", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
    ) as {
      git?: {
        deploymentEnabled?: Record<string, boolean>
      }
    }

    expect(config.git?.deploymentEnabled).toEqual({
      "**": false,
      main: true,
      "preview/**": true,
    })
  })
})
