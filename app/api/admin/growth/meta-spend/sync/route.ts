import { createClient } from "@/lib/supabase/server"
import { syncMetaSpend } from "@/lib/growth/meta-spend-server"
import { MetaSpendError } from "@/lib/growth/meta-spend-source"

export const maxDuration = 60

export async function POST(request: Request) {
  // This route performs mutations; reject cross-origin cookie-authenticated requests.
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403 })
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return Response.json({ error: "unauthorized" }, { status: 401 })
  const profile = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
  if (profile.error || profile.data?.is_admin !== true) return Response.json({ error: "forbidden" }, { status: 403 })
  try {
    return Response.json({ ok: true, ...await syncMetaSpend() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const code = error instanceof MetaSpendError ? error.code : "meta_sync_failed"
    return Response.json({ ok: false, error: code }, { status: code === "meta_sync_busy" ? 409 : 503, headers: { "Cache-Control": "no-store" } })
  }
}
