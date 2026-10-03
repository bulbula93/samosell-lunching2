import { Blob as NodeBlob } from "node:buffer"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { saveBrowserConsent } from "@/lib/browser-preferences"
import { clearAllListingDrafts, deleteListingDraft, DRAFT_TTL_MS, isUsableDraft, readListingDraft, saveListingDraft, type ListingDraft } from "@/lib/listing-draft"

const draft = (): ListingDraft => ({
  userId: "owner-a", updatedAt: Date.now(), sizeType: "clothing",
  fields: { title: "ქურთუკი", description: "ტესტი", price: "30", categoryId: 1, brandId: "", customBrand: "", sizeId: "",
    condition: "good", saleType: "sell", gender: "unisex", color: "", material: "", city: "თბილისი", publishNow: true },
  images: [{ id: "photo-1", name: "item.jpg", type: "image/jpeg", lastModified: 1, blob: new NodeBlob(["photo"], { type: "image/jpeg" }) as unknown as Blob }],
})

beforeEach(() => {
  localStorage.clear(); document.cookie = "samosell_browser_consent=; Max-Age=0; Path=/"
  vi.stubGlobal("indexedDB", new IDBFactory())
  vi.stubGlobal("Blob", NodeBlob)
})
afterEach(() => vi.unstubAllGlobals())

describe("local listing draft persistence", () => {
  it("does not save without permission, then restores text and photo only for its owner", async () => {
    await expect(saveListingDraft(draft())).resolves.toBe(false)
    saveBrowserConsent(true, false)
    await saveListingDraft(draft())
    expect(await readListingDraft("owner-b")).toBeNull()
    const stored = await readListingDraft("owner-a")
    expect(stored?.fields.title).toBe("ქურთუკი")
    expect(stored?.images[0].name).toBe("item.jpg")
    expect(await stored?.images[0].blob.text()).toBe("photo")
  })

  it("does not restore expired or malformed drafts", async () => {
    saveBrowserConsent(true, false)
    const old = { ...draft(), updatedAt: Date.now() - DRAFT_TTL_MS - 1 }
    await saveListingDraft(old)
    expect(await readListingDraft("owner-a")).toBeNull()
    expect(isUsableDraft({ ...draft(), fields: { title: "incomplete" } }, "owner-a")).toBe(false)
  })

  it("orders deletion after an in-flight save and clears all accounts on withdrawal", async () => {
    saveBrowserConsent(true, false)
    const save = saveListingDraft(draft())
    const remove = deleteListingDraft("owner-a")
    await Promise.all([save, remove])
    expect(await readListingDraft("owner-a")).toBeNull()
    await saveListingDraft(draft())
    saveBrowserConsent(false, false)
    await clearAllListingDrafts()
    saveBrowserConsent(true, false)
    expect(await readListingDraft("owner-a")).toBeNull()
  })

  it("reports quota failure without changing the published listing flow", async () => {
    saveBrowserConsent(true, false)
    vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError") })
    await expect(saveListingDraft(draft())).rejects.toThrow("quota")
  })
})
