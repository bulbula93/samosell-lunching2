import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("Disk I/O cron optimization", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase", "migrations", "20260928133000_optimize_disk_io_cron_cadence.sql"),
    "utf8",
  )

  it("reduces bookkeeping reconciliation cadence to every 15 minutes", () => {
    expect(migration).toContain("reconcile-listing-boosts")
    expect(migration).toContain("reconcile-self-service-brand-ads")
    expect(migration.match(/'\*\/15 \* \* \* \*'/g)).toHaveLength(2)
    expect(migration).toContain("cron.alter_job")
  })

  it("does not modify payment recovery or push dispatch cadence", () => {
    expect(migration).not.toContain("samosell-tbc-recovery")
    expect(migration).not.toContain("samosell-push-dispatch")
  })
})
