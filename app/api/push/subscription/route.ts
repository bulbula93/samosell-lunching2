import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type SubscriptionPayload = {
  endpoint?: unknown
  keys?: {
    p256dh?: unknown
    auth?: unknown
  }
}

function sameOrigin(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site")
  if (fetchSite && fetchSite !== "same-origin") return false

  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function validEndpoint(value: unknown) {
  const endpoint = String(value ?? "").trim()
  if (endpoint.length < 20 || endpoint.length > 2048) return null
  try {
    const parsed = new URL(endpoint)
    return parsed.protocol === "https:" ? endpoint : null
  } catch {
    return null
  }
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: config }, { count }] = await Promise.all([
    admin.from("push_config").select("vapid_public_key").eq("id", 1).maybeSingle(),
    admin
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true),
  ])

  return NextResponse.json({
    vapidPublicKey: config?.vapid_public_key ?? "",
    subscribed: Number(count ?? 0) > 0,
  })
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 })
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const payload = (await request.json().catch(() => null)) as SubscriptionPayload | null
  const endpoint = validEndpoint(payload?.endpoint)
  const p256dh = String(payload?.keys?.p256dh ?? "").trim()
  const authSecret = String(payload?.keys?.auth ?? "").trim()
  if (!endpoint || p256dh.length < 20 || p256dh.length > 512 || authSecret.length < 8 || authSecret.length > 256) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint,
    p256dh,
    auth_secret: authSecret,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    is_active: true,
    updated_at: now,
    last_seen_at: now,
  }, { onConflict: "endpoint" })

  if (error) return NextResponse.json({ error: "subscription_save_failed" }, { status: 500 })

  const { data: activeRows } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false })

  const excessIds = (activeRows ?? []).slice(8).map((row) => row.id)
  if (excessIds.length) {
    await admin
      .from("push_subscriptions")
      .update({ is_active: false, updated_at: now })
      .in("id", excessIds)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 })
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const payload = (await request.json().catch(() => null)) as { endpoint?: unknown } | null
  const endpoint = validEndpoint(payload?.endpoint)
  if (!endpoint) return NextResponse.json({ error: "invalid_subscription" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)

  if (error) return NextResponse.json({ error: "subscription_delete_failed" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
