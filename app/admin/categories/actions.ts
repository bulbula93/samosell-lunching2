"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdminUser } from "@/lib/auth"

const NOTE_MAX_LENGTH = 2000
const LABEL_MAX_LENGTH = 80

function withFlash(path: string, message: string, type: "ok" | "error" = "ok") {
  const url = new URL(path, "https://samosell.local")
  url.searchParams.set(type, message)
  return `${url.pathname}${url.search}`
}

function errorMessage(message: string) {
  switch (message) {
    case "not_authenticated":
      return "საჭიროა ავტორიზაცია."
    case "not_authorized":
      return "ამ მოქმედებისთვის ადმინისტრატორის უფლებაა საჭირო."
    case "category_not_found":
      return "კატეგორია ვერ მოიძებნა."
    case "invalid_category_name":
      return "კატეგორიის სახელი 1–80 სიმბოლო უნდა იყოს."
    case "invalid_category_navigation_label":
      return "Navigation label მაქსიმუმ 80 სიმბოლო უნდა იყოს."
    case "invalid_category_sort_order":
      return "რიგითობა 0-დან 1000-მდე უნდა იყოს."
    case "admin_note_too_long":
      return "Admin შენიშვნა მაქსიმუმ 2000 სიმბოლო უნდა იყოს."
    default:
      return "კატეგორიის ცვლილება ვერ შესრულდა."
  }
}

export async function updateAdminCategoryAction(formData: FormData) {
  const categoryId = Number(formData.get("categoryId"))
  const name = String(formData.get("name") || "").trim()
  const navigationLabel = String(formData.get("navigationLabel") || "").trim()
  const sortOrder = Number(formData.get("sortOrder"))
  const isActive = formData.get("isActive") === "on"
  const note = String(formData.get("adminNote") || "").trim()
  const path = "/admin/categories"

  if (
    !Number.isSafeInteger(categoryId) ||
    categoryId <= 0 ||
    name.length < 1 ||
    name.length > LABEL_MAX_LENGTH ||
    navigationLabel.length > LABEL_MAX_LENGTH ||
    !Number.isSafeInteger(sortOrder) ||
    sortOrder < 0 ||
    sortOrder > 1000 ||
    note.length > NOTE_MAX_LENGTH
  ) {
    redirect(withFlash(path, "შეამოწმე კატეგორიის ველები.", "error"))
  }

  const { supabase } = await requireAdminUser("/dashboard")
  const { error } = await supabase.rpc("admin_update_category", {
    p_category_id: categoryId,
    p_name: name,
    p_navigation_label: navigationLabel,
    p_sort_order: sortOrder,
    p_is_active: isActive,
    p_note: note,
  })

  if (error) {
    redirect(withFlash(path, errorMessage(error.message), "error"))
  }

  revalidateTag("marketplace-navigation", "max")
  revalidatePath("/")
  revalidatePath("/catalog")
  revalidatePath("/dashboard/listings/new")
  revalidatePath("/admin")
  revalidatePath("/admin/categories")
  revalidatePath("/admin/audit")

  redirect(withFlash(path, "კატეგორია განახლდა."))
}
