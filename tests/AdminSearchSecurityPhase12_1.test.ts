import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const serviceMigration = read("supabase/migrations/20260831064206_add_service_only_admin_search_rpcs.sql")
const lockMigration = read("supabase/migrations/20260831064657_lock_down_legacy_admin_search_rpcs.sql")
const tableGrantMigration = read("supabase/migrations/20260831064851_revoke_internal_search_table_client_grants.sql")
const page = read("app/admin/search/page.tsx")
const actions = read("app/admin/search/actions.ts")

describe("Phase 12.1 admin search security cleanup", () => {
  it("routes admin search reads through service-role-only RPCs", () => {
    expect(page).toContain('createAdminClient')
    expect(page).toContain('get_search_analytics_summary_service')
    expect(page).toContain('admin_list_search_aliases_service')
    expect(page).toContain('admin_list_search_experiments_service')
    expect(serviceMigration).toContain('grant execute on function public.get_search_analytics_summary_service(uuid, integer) to service_role')
    expect(serviceMigration).toContain('from public, anon, authenticated')
  })

  it("routes alias writes through service-only RPCs while preserving the admin actor", () => {
    expect(actions).toContain('createAdminClient')
    expect(actions).toContain('admin_upsert_search_alias_service')
    expect(actions).toContain('admin_delete_search_alias_service')
    expect(actions).toContain('p_actor_id: user.id')
    expect(serviceMigration).toContain('created_by)')
    expect(serviceMigration).toContain('p_actor_id)')
  })

  it("removes legacy Admin Search RPC execution from API roles", () => {
    expect(lockMigration).toContain('revoke all on function public.admin_delete_search_alias(bigint)')
    expect(lockMigration).toContain('revoke all on function public.admin_list_search_aliases()')
    expect(lockMigration).toContain('revoke all on function public.admin_list_search_experiments()')
    expect(lockMigration).toContain('revoke all on function public.admin_upsert_search_alias(text, text, text)')
    expect(lockMigration).toContain('revoke all on function public.get_search_analytics_summary(integer)')
    expect(lockMigration).toContain('revoke all on function public.update_search_ranking_config(text, jsonb)')
  })

  it("removes unnecessary direct client grants from internal search tables", () => {
    expect(tableGrantMigration).toContain('revoke all on table public.search_impressions from anon, authenticated')
    expect(tableGrantMigration).toContain('revoke all on table public.search_interactions from anon, authenticated')
    expect(tableGrantMigration).toContain('revoke all on table public.search_ranking_config_history from anon, authenticated')
  })
})
