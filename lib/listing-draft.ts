import { allowsPersonalization } from "@/lib/browser-preferences"
import type { ListingFormInput } from "@/lib/listing-form"
import type { ListingSizeType } from "@/lib/marketplace-options"

const DB_NAME = "samosell-listing-drafts-v1"
const STORE = "drafts"
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000
export type ListingDraft = {
  userId: string
  updatedAt: number
  fields: Omit<ListingFormInput, "sellerPhone">
  sizeType: ListingSizeType
  images: Array<{ id: string; name: string; type: string; lastModified: number; blob: Blob }>
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "userId" })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("draft_storage_blocked"))
  })
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error ?? request.error)
      tx.onabort = () => reject(tx.error ?? new Error("draft_storage_aborted"))
    })
  } finally { db.close() }
}

export function isUsableDraft(value: unknown, userId: string): value is ListingDraft {
  const draft = value as ListingDraft | null
  return Boolean(draft && draft.userId === userId && Number.isFinite(draft.updatedAt) &&
    draft.updatedAt <= Date.now() && Date.now() - draft.updatedAt < DRAFT_TTL_MS &&
    draft.fields && ["title", "description", "price", "brandId", "sizeId", "condition", "saleType", "gender", "color", "material", "city"].every((key) => typeof (draft.fields as unknown as Record<string, unknown>)[key] === "string") &&
    typeof draft.fields.publishNow === "boolean" && ["string", "number"].includes(typeof draft.fields.categoryId) &&
    ["clothing", "bottoms", "shoes", "kids", "kids_shoes", "universal"].includes(draft.sizeType) &&
    Array.isArray(draft.images) && draft.images.length <= 8 && draft.images.every((image) =>
      image.blob instanceof Blob && image.blob.size <= 7 * 1024 * 1024 && typeof image.name === "string" &&
      typeof image.id === "string" && ["image/jpeg", "image/png", "image/webp"].includes(image.type)))
}

// Serialize writes/deletes so publishing or revoking consent cannot race an older save.
let mutations: Promise<unknown> = Promise.resolve()
function mutate<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutations.then(operation, operation)
  mutations = result.catch(() => undefined)
  return result
}

export async function readListingDraft(userId: string) {
  if (!allowsPersonalization() || !userId || typeof indexedDB === "undefined") return null
  await mutations
  const draft = await transaction("readonly", (store) => store.get(userId))
  if (!allowsPersonalization()) return null
  if (!isUsableDraft(draft, userId)) {
    if (draft) await deleteListingDraft(userId)
    return null
  }
  return draft
}

export function saveListingDraft(draft: ListingDraft) {
  return mutate(async () => {
    if (!allowsPersonalization()) return false
    await transaction("readwrite", (store) => store.put(draft))
    return true
  })
}

export function deleteListingDraft(userId: string) {
  return mutate(async () => {
    if (typeof indexedDB !== "undefined") await transaction("readwrite", (store) => store.delete(userId))
  })
}

export function clearAllListingDrafts() {
  return mutate(async () => {
    if (typeof indexedDB !== "undefined") await transaction("readwrite", (store) => store.clear())
  })
}
