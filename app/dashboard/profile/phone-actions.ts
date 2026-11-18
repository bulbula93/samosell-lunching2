"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isValidSellerPhone, normalizeSellerPhone, SELLER_PHONE_MAX_LENGTH } from "@/lib/phone"
import { enforceRateLimit } from "@/lib/rate-limit"
import { invalidatePublicMarketplace } from "@/lib/public-marketplace-invalidation"
import { isReadOnlyPreview } from "@/lib/preview-read-only"

type PhoneResult = { ok: true } | { ok: false; code: "invalid" | "unauthorized" | "unavailable"; message: string }

export async function saveSellerPhoneAction(value: string): Promise<PhoneResult> {
  if (isReadOnlyPreview()) return { ok: false, code: "unavailable", message: "ამ სანახავ ვერსიაში ნომრის შენახვა გამორთულია." }
  if (typeof value !== "string" || value.length > SELLER_PHONE_MAX_LENGTH || !isValidSellerPhone(value)) {
    return { ok: false, code: "invalid", message: "მიუთითე მოქმედი ტელეფონის ნომერი 7–15 ციფრით." }
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { ok: false, code: "unauthorized", message: "სესია დასრულდა. თავიდან შედი ანგარიშში და გააგრძელე." }
    await enforceRateLimit(supabase, "listing_status_update")
    // The caller supplies no owner ID; the authenticated client also remains subject to RLS.
    const { data, error } = await supabase.from("profiles")
      .update({ store_phone: normalizeSellerPhone(value) })
      .eq("id", user.id).select("id").maybeSingle()
    if (error || !data) return { ok: false, code: "unavailable", message: "ნომრის შენახვა ვერ მოხერხდა. სცადე ხელახლა ან განაახლე პროფილი." }

    // A cache failure must not misreport a successfully saved phone as an unsuccessful write.
    try {
      invalidatePublicMarketplace()
      revalidatePath("/dashboard/profile")
      revalidatePath("/dashboard/listings/new")
    } catch { /* The dynamic listing form reads the profile again on refresh. */ }
    return { ok: true }
  } catch {
    return { ok: false, code: "unavailable", message: "ნომრის შენახვა დროებით ვერ ხერხდება. ცოტა ხანში სცადე ხელახლა." }
  }
}
