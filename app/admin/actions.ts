"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdminUser } from "@/lib/auth"
import { isUuid } from "@/lib/moderation"

const NOTE_MAX_LENGTH = 2000

function adminErrorMessage(message: string) {
  switch (message) {
    case "not_authenticated":
      return "საჭიროა ავტორიზაცია."
    case "not_authorized":
      return "ამ მოქმედებისთვის ადმინისტრატორის უფლებაა საჭირო."
    case "listing_not_found":
      return "განცხადება ვერ მოიძებნა."
    case "listing_not_hideable":
      return "ამ სტატუსის განცხადების დამალვა ამ მოქმედებით შეუძლებელია."
    case "listing_not_restorable":
      return "განცხადება აღსადგენ მდგომარეობაში არ არის."
    case "listing_restore_state_missing":
      return "აღდგენის წინა სტატუსი audit history-ში ვერ მოიძებნა."
    case "seller_suspended":
      return "შეზღუდული გამყიდველის განცხადების აღდგენა ჯერ შეუძლებელია."
    case "user_not_found":
      return "მომხმარებელი ვერ მოიძებნა."
    case "cannot_suspend_self":
      return "საკუთარი ადმინისტრატორის ანგარიშის შეზღუდვა შეუძლებელია."
    case "cannot_suspend_admin":
      return "სხვა ადმინისტრატორის შეზღუდვა ამ პანელიდან დაბლოკილია."
    case "cannot_change_self_verification":
      return "საკუთარი seller verification-ის შეცვლა ამ პანელიდან დაბლოკილია."
    case "user_already_suspended":
      return "მომხმარებელი უკვე შეზღუდულია."
    case "user_not_suspended":
      return "მომხმარებელი შეზღუდული არ არის."
    case "seller_already_verified":
      return "გამყიდველი უკვე ვერიფიცირებულია."
    case "seller_not_verified":
      return "გამყიდველი ვერიფიცირებული არ არის."
    case "admin_note_too_long":
      return "ადმინისტრატორის შენიშვნა მაქსიმუმ 2000 სიმბოლო უნდა იყოს."
    default:
      return "მოქმედება ვერ შესრულდა."
  }
}

function withFlash(path: string, message: string, type: "ok" | "error" = "ok") {
  const url = new URL(path, "https://samosell.local")
  url.searchParams.set(type, message)
  return `${url.pathname}${url.search}`
}

function safeNote(formData: FormData) {
  return String(formData.get("adminNote") || "").trim()
}

export async function adminListingAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "")
  const action = String(formData.get("decision") || "")
  const note = safeNote(formData)
  const adminPath = "/admin/listings"

  if (!isUuid(listingId) || !["hide", "restore"].includes(action) || note.length > NOTE_MAX_LENGTH) {
    redirect(withFlash(adminPath, "მოქმედების მონაცემები არასწორია.", "error"))
  }

  const { supabase } = await requireAdminUser("/dashboard")
  const { error } = await supabase.rpc("admin_manage_listing", {
    p_listing_id: listingId,
    p_action: action,
    p_note: note,
  })

  if (error) {
    redirect(withFlash(adminPath, adminErrorMessage(error.message), "error"))
  }

  revalidatePath("/")
  revalidatePath("/catalog")
  revalidatePath("/admin")
  revalidatePath("/admin/listings")
  revalidatePath("/admin/audit")

  redirect(
    withFlash(
      adminPath,
      action === "hide" ? "განცხადება დამალულია." : "განცხადება აღდგენილია.",
    ),
  )
}

export async function adminUserAction(formData: FormData) {
  const userId = String(formData.get("userId") || "")
  const action = String(formData.get("decision") || "")
  const note = safeNote(formData)
  const requestedReturnPath = String(formData.get("returnPath") || "")
  const adminPath = requestedReturnPath === "/admin/stores" ? "/admin/stores" : "/admin/users"

  if (
    !isUuid(userId) ||
    !["suspend", "restore", "verify", "unverify"].includes(action) ||
    note.length > NOTE_MAX_LENGTH
  ) {
    redirect(withFlash(adminPath, "მოქმედების მონაცემები არასწორია.", "error"))
  }

  const { supabase } = await requireAdminUser("/dashboard")
  const { error } = await supabase.rpc("admin_manage_user", {
    p_user_id: userId,
    p_action: action,
    p_note: note,
  })

  if (error) {
    redirect(withFlash(adminPath, adminErrorMessage(error.message), "error"))
  }

  revalidatePath("/")
  revalidatePath("/catalog")
  revalidatePath("/admin")
  revalidatePath("/admin/users")
  revalidatePath("/admin/stores")
  revalidatePath("/admin/listings")
  revalidatePath("/admin/audit")

  const message =
    action === "suspend"
      ? "მომხმარებელი შეიზღუდა და მისი აქტიური/დაჯავშნილი განცხადებები დაარქივდა."
      : action === "restore"
        ? "მომხმარებელს შეზღუდვა მოეხსნა. განცხადებები ავტომატურად არ გამოქვეყნებულა."
        : action === "verify"
          ? "გამყიდველი ვერიფიცირებულია."
          : "გამყიდველის ვერიფიკაცია მოხსნილია."

  redirect(withFlash(adminPath, message))
}
