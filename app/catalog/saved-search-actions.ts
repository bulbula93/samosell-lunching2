"use server"

import { redirect } from "next/navigation"
import { requireAuthenticatedUser } from "@/lib/auth"
import {
  resolveCatalogState,
  type CatalogSearchParams,
} from "@/lib/catalog-page"
import {
  buildSavedSearchLabel,
  buildSavedSearchPath,
  buildSavedSearchTerms,
  hasSavableCatalogFilters,
  parseSavedSearchPrice,
} from "@/lib/saved-searches"

function formText(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

function statusPath(path: string, status: string) {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}saved_search_status=${encodeURIComponent(status)}`
}

export async function saveCatalogSearchAction(formData: FormData) {
  const params: CatalogSearchParams = {
    q: formText(formData, "q"),
    category: formText(formData, "category"),
    item_type: formText(formData, "item_type"),
    brand: formText(formData, "brand"),
    size: formText(formData, "size"),
    color: formText(formData, "color"),
    city: formText(formData, "city"),
    condition: formText(formData, "condition"),
    gender: formText(formData, "gender"),
    vip: formText(formData, "vip"),
    min_price: formText(formData, "min_price"),
    max_price: formText(formData, "max_price"),
  }

  const { filters } = resolveCatalogState(params)
  const path = buildSavedSearchPath(filters)

  if (!hasSavableCatalogFilters(filters)) {
    redirect(statusPath(path, "empty"))
  }

  const label = buildSavedSearchLabel(filters)
  const minPrice = parseSavedSearchPrice(filters.min_price)
  const maxPrice = parseSavedSearchPrice(filters.max_price)

  if (
    (filters.min_price && minPrice === null) ||
    (filters.max_price && maxPrice === null) ||
    (minPrice !== null && maxPrice !== null && minPrice > maxPrice)
  ) {
    redirect(statusPath(path, "invalid"))
  }

  const { supabase } = await requireAuthenticatedUser(path)
  const { error } = await supabase.rpc("save_catalog_search", {
    p_label: label,
    p_catalog_path: path,
    p_q: filters.q,
    p_category: filters.category,
    p_item_type: filters.item_type,
    p_brand: filters.brand,
    p_size: filters.size,
    p_color: filters.color,
    p_city: filters.city,
    p_condition: filters.condition,
    p_gender: filters.gender,
    p_vip: filters.vip === "1",
    p_min_price: minPrice,
    p_max_price: maxPrice,
    p_search_terms: buildSavedSearchTerms(filters),
  })

  if (error) {
    const message = String(error.message ?? "")
    if (message.includes("saved_search_limit_reached")) {
      redirect(statusPath(path, "limit"))
    }
    redirect(statusPath(path, "error"))
  }

  redirect(statusPath(path, "saved"))
}
