import { createHash, randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const QA_PROJECT_REF = "ydocqjdjmffysexkzxyc"
const QA_ADMIN_EMAIL = "qa-growth-admin@samosell.ge"

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export async function GET(request: Request) {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  if (!supabaseUrl.includes(QA_PROJECT_REF)) {
    return NextResponse.json({ error: "not_qa_environment" }, { status: 404 })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")?.trim() ?? ""
  if (token.length < 20) {
    return NextResponse.json({ error: "invalid_token" }, { status: 403 })
  }

  const admin = createAdminClient()
  const hash = tokenHash(token)

  const { data: bootstrap, error: bootstrapError } = await admin
    .from("qa_bootstrap_tokens")
    .select("id, expires_at, used_at")
    .eq("token_hash", hash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (bootstrapError || !bootstrap) {
    return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 403 })
  }

  const password =
    randomBytes(24).toString("base64url") + "Aa9!"

  let userId = ""

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: QA_ADMIN_EMAIL,
      password,
      email_confirm: true,
      user_metadata: {
        username: "qa_growth_admin",
        full_name: "SamoSell QA Admin",
      },
    })

  if (createError) {
    const { data: users, error: listError } =
      await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })

    const existing = users?.users?.find(
      (user) => user.email?.toLowerCase() === QA_ADMIN_EMAIL.toLowerCase(),
    )

    if (listError || !existing) {
      console.error("qa_bootstrap_create_user_failed", {
        message: createError.message,
      })
      return NextResponse.json({ error: "qa_user_creation_failed" }, { status: 500 })
    }

    userId = existing.id
    const { error: updateError } = await admin.auth.admin.updateUserById(
      userId,
      {
        password,
        email_confirm: true,
        user_metadata: {
          username: "qa_growth_admin",
          full_name: "SamoSell QA Admin",
        },
      },
    )

    if (updateError) {
      return NextResponse.json({ error: "qa_user_update_failed" }, { status: 500 })
    }
  } else {
    userId = created.user.id
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        username: "qa_growth_admin",
        full_name: "SamoSell QA Admin",
        is_admin: true,
        is_suspended: false,
      },
      { onConflict: "id" },
    )

  if (profileError) {
    return NextResponse.json({ error: "qa_admin_profile_failed" }, { status: 500 })
  }

  await admin
    .from("qa_bootstrap_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", bootstrap.id)

  return NextResponse.json(
    {
      ok: true,
      email: QA_ADMIN_EMAIL,
      password,
      next: "/admin/growth",
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  )
}
