import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260920220851_harden_tbc_refund_execution.sql"),
  "utf8",
)
const actions = readFileSync(join(process.cwd(), "app/admin/payments/actions.ts"), "utf8")
const recovery = readFileSync(join(process.cwd(), "app/api/internal/tbc/reconcile/route.ts"), "utf8")
const sync = readFileSync(join(process.cwd(), "lib/tbc-sync.ts"), "utf8")

describe("TBC refund execution hardening", () => {
  it("claims a refund before provider I/O and blocks browser execution", () => {
    expect(migration).toContain("claim_tbc_refund_execution")
    expect(migration).toContain("status = 'provider_processing'")
    expect(migration).toContain("provider_attempted_at = v_now")
    expect(migration).toContain("grant execute on function public.claim_tbc_refund_execution(uuid,uuid) to service_role")
    expect(migration).toContain("from public,anon,authenticated")
  })

  it("keeps ambiguous provider outcomes open for status reconciliation instead of retrying cancel", () => {
    expect(migration).toContain("p_outcome not in ('accepted','rejected','ambiguous')")
    expect(migration).toContain("case when p_outcome = 'ambiguous'")
    expect(actions).toContain('p_outcome: "ambiguous"')
    expect(actions).toContain('paymentsRedirect(nextPath, "refund_provider_uncertain")')
  })

  it("uses authoritative TBC status polling to finish processing refunds", () => {
    expect(sync).toContain("reconcileProcessingTbcRefunds")
    expect(sync).toContain('.eq("status", "provider_processing")')
    expect(sync).toContain('providerStatus === "Returned" || providerStatus === "PartialReturned"')
    expect(recovery).toContain("reconcileProcessingTbcRefunds(2)")
  })

  it("accepts either Vercel CRON_SECRET or the Vault-backed recovery token", () => {
    expect(recovery).toContain("process.env.CRON_SECRET")
    expect(recovery).toContain('"verify_tbc_recovery_token"')
    expect(migration).toContain("vault.decrypted_secrets")
    expect(migration).toContain("samosell_tbc_recovery_token")
  })
})
