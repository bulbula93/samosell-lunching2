import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.57.4"
import webpush from "npm:web-push@3.6.7"

type Delivery = {
  delivery_id: string
  subscription_id: string
  endpoint: string
  p256dh: string
  auth_secret: string
  notification_id: string
  notification_type: string
  title: string
  body: string
  href: string
}

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, { error: "method_not_allowed" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!supabaseUrl || !serviceRoleKey) return response(500, { error: "server_config_missing" })

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const [{ data: config, error: configError }, input] = await Promise.all([
    admin
      .from("push_config")
      .select("vapid_public_key, vapid_private_key, dispatch_secret, subject")
      .eq("id", 1)
      .maybeSingle(),
    req.json().catch(() => ({})) as Promise<Record<string, unknown>>,
  ])

  if (configError || !config) return response(503, { error: "push_config_unavailable" })
  if (typeof input.secret !== "string" || input.secret !== config.dispatch_secret) {
    return response(401, { error: "invalid_dispatch_secret" })
  }

  webpush.setVapidDetails(config.subject, config.vapid_public_key, config.vapid_private_key)

  const { data, error } = await admin.rpc("claim_push_deliveries", { p_limit: 50 })
  if (error) return response(500, { error: "claim_failed" })

  const deliveries = (Array.isArray(data) ? data : []) as Delivery[]
  let sent = 0
  let gone = 0
  let retried = 0
  let failed = 0

  for (const delivery of deliveries) {
    const url = delivery.href?.startsWith("/") ? delivery.href : "/dashboard/notifications"
    const payload = JSON.stringify({
      title: delivery.title || "SamoSell",
      body: delivery.body || "ახალი შეტყობინება გაქვს",
      url,
      tag: `samosell:${delivery.notification_id}`,
      type: delivery.notification_type,
      icon: "/icon.svg",
      badge: "/icon.svg",
    })

    let nextStatus = "sent"
    let errorText: string | null = null

    try {
      await webpush.sendNotification(
        {
          endpoint: delivery.endpoint,
          keys: { p256dh: delivery.p256dh, auth: delivery.auth_secret },
        },
        payload,
        { TTL: 3600, urgency: "high" },
      )
      sent += 1
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode ?? 0)
      errorText = String((error as Error)?.message ?? "push_send_failed").slice(0, 500)
      if (statusCode === 404 || statusCode === 410) {
        nextStatus = "gone"
        gone += 1
      } else if (statusCode === 429 || statusCode >= 500 || statusCode === 0) {
        nextStatus = "pending"
        retried += 1
      } else {
        nextStatus = "failed"
        failed += 1
      }
    }

    const { error: finishError } = await admin.rpc("finish_push_delivery", {
      p_delivery_id: delivery.delivery_id,
      p_status: nextStatus,
      p_error: errorText,
    })

    if (finishError) {
      console.error("[push-dispatch] finish failed", delivery.delivery_id, finishError.message)
    }
  }

  return response(200, {
    claimed: deliveries.length,
    sent,
    gone,
    retried,
    failed,
  })
})
