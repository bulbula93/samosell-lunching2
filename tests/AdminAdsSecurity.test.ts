import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const actions = fs.readFileSync(path.join(root, "app/admin/ads/actions.ts"), "utf8")
const page = fs.readFileSync(path.join(root, "app/admin/ads/page.tsx"), "utf8")
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260904093934_add_admin_ad_image_storage.sql"), "utf8")

describe("admin ads security boundaries", () => {
  it("rechecks admin authorization in every mutation", () => {
    expect(actions.match(/requireAdminUser\("\/dashboard"\)/g)).toHaveLength(3)
    expect(page).toContain('requireAdminUser("/dashboard")')
  })

  it("keeps ad image writes on the server-only admin client", () => {
    expect(actions).toContain("createAdminClient")
    expect(actions).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE")
    expect(migration).not.toContain("create policy")
    expect(migration).toContain("'ad-images'")
    expect(migration).toContain("grant execute on function public.get_admin_ad_event_counts_service(uuid)")
    expect(migration).toContain("to service_role")
    expect(migration).toContain("p.is_admin = true")
  })

  it("does not add a hard-delete control", () => {
    expect(actions).not.toContain('.from("ads").delete()')
    expect(page).not.toContain("რეკლამის წაშლა")
  })
})
