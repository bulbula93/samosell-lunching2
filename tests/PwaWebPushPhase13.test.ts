import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const migration = read("supabase/migrations/20260831070335_add_pwa_web_push_phase_13.sql")
const optimizationMigration = read("supabase/migrations/20260831071609_optimize_pwa_push_dispatch_phase_13.sql")
const worker = read("supabase/functions/push-dispatch/index.ts")
const serviceWorker = read("public/sw.js")
const subscriptionRoute = read("app/api/push/subscription/route.ts")
const settings = read("components/pwa/PushPwaSettings.tsx")
const manifest = read("app/manifest.ts")

describe("Phase 13 PWA + Web Push", () => {
  it("keeps push subscription and delivery tables off the direct client surface", () => {
    expect(migration).toContain("revoke all on table public.push_subscriptions from public, anon, authenticated")
    expect(migration).toContain("revoke all on table public.push_deliveries from public, anon, authenticated")
    expect(migration).toContain("revoke all on table public.push_config from public, anon, authenticated")
  })

  it("queues the requested marketplace notification types", () => {
    for (const type of ["chat_message", "offer_created", "reservation_created", "saved_search_match", "price_drop"]) {
      expect(migration).toContain(`'${type}'`)
    }
    expect(migration).toContain("unique(notification_id, subscription_id)")
  })

  it("does not commit VAPID private material", () => {
    expect(migration).toContain("Never commit the private key")
    expect(worker).not.toContain("vapid_private_key: \"")
  })

  it("requires an explicit user gesture before asking for notification permission", () => {
    expect(settings).toContain("async function enablePush")
    expect(settings).toContain("Notification.requestPermission()")
    expect(settings).not.toContain('useEffect(() => {\n    void Notification.requestPermission')
  })

  it("validates same-origin subscription writes and authenticated ownership", () => {
    expect(subscriptionRoute).toContain("if (!origin) return false")
    expect(subscriptionRoute).toContain('fetchSite !== "same-origin"')
    expect(subscriptionRoute).toContain("if (!user)")
    expect(subscriptionRoute).toContain('.eq("user_id", user.id)')
  })

  it("supports installability and notification click deep links", () => {
    expect(manifest).toContain('id: "/"')
    expect(manifest).toContain('sizes: "192x192"')
    expect(manifest).toContain('sizes: "512x512"')
    expect(manifest).toContain('display: "standalone"')
    expect(serviceWorker).toContain('self.addEventListener("push"')
    expect(serviceWorker).toContain('self.addEventListener("notificationclick"')
    expect(serviceWorker).toContain("openWindow(targetUrl)")
  })

  it("dispatches only when queue work exists and uses a bounded retry cadence", () => {
    expect(optimizationMigration).toContain("if not exists")
    expect(optimizationMigration).toContain("get diagnostics v_enqueued = row_count")
    expect(optimizationMigration).toContain("if v_enqueued > 0")
    expect(optimizationMigration).toContain("'*/5 * * * *'")
  })
})
