"use server"

import { revalidatePath } from "next/cache"
import { requireAdminUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

const ALIAS_KINDS = new Set(["synonym", "transliteration", "brand", "category"])

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

export async function upsertSearchAliasAction(formData: FormData) {
  const canonicalTerm = readText(formData, "canonicalTerm")
  const alias = readText(formData, "alias")
  const requestedKind = readText(formData, "kind").toLowerCase()
  const kind = ALIAS_KINDS.has(requestedKind) ? requestedKind : "synonym"

  if (!canonicalTerm || !alias || canonicalTerm.length > 120 || alias.length > 120) {
    return
  }

  const { user } = await requireAdminUser("/dashboard")
  const admin = createAdminClient()
  const { error } = await admin.rpc("admin_upsert_search_alias_service", {
    p_actor_id: user.id,
    p_canonical_term: canonicalTerm,
    p_alias: alias,
    p_kind: kind,
  })

  if (error) {
    throw new Error(`search_alias_save_failed:${error.message}`)
  }

  revalidatePath("/admin/search")
}

export async function deleteSearchAliasAction(formData: FormData) {
  const rawId = readText(formData, "aliasId")
  if (!/^\d+$/.test(rawId)) return

  const aliasId = Number(rawId)
  if (!Number.isSafeInteger(aliasId) || aliasId < 1) return

  const { user } = await requireAdminUser("/dashboard")
  const admin = createAdminClient()
  const { error } = await admin.rpc("admin_delete_search_alias_service", {
    p_actor_id: user.id,
    p_id: aliasId,
  })

  if (error) {
    throw new Error(`search_alias_delete_failed:${error.message}`)
  }

  revalidatePath("/admin/search")
}
