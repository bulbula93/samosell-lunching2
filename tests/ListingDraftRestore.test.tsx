import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import CreateListingWizard from "@/components/dashboard/CreateListingWizard"
import { saveBrowserConsent } from "@/lib/browser-preferences"
import { readListingDraft, saveListingDraft, deleteListingDraft } from "@/lib/listing-draft"
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("@/app/dashboard/listings/form-actions", () => ({ prepareListingUploadsAction: vi.fn(), saveListingAction: vi.fn(), abortListingUploadsAction: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: vi.fn() } }) }))
vi.mock("@/lib/listing-draft", () => ({ readListingDraft: vi.fn(), saveListingDraft: vi.fn(() => Promise.resolve(true)), deleteListingDraft: vi.fn(() => Promise.resolve()) }))
const props = { categories: [{ id: 1, slug: "women", name: "ქალებისთვის" }], brands: [], sizes: [], initialSellerPhone: "+995 555 12 34 56", userId: "owner-a" }
beforeEach(() => {
  localStorage.clear(); document.cookie = "samosell_browser_consent=; Max-Age=0; Path=/"; vi.clearAllMocks(); saveBrowserConsent(true, false)
  Element.prototype.scrollIntoView = vi.fn()
  URL.createObjectURL = vi.fn(() => "blob:restored")
  URL.revokeObjectURL = vi.fn()
  vi.mocked(readListingDraft).mockResolvedValue({ userId: "owner-a", updatedAt: Date.now(), sizeType: "clothing",
    fields: { title: "შენახული ქურთუკი", description: "კარგ მდგომარეობაშია.", price: "25", categoryId: 1, brandId: "", customBrand: "", sizeId: "", condition: "good", saleType: "sell", gender: "unisex", color: "", material: "", city: "თბილისი", publishNow: true },
    images: [{ id: "photo-1", name: "item.jpg", type: "image/jpeg", lastModified: 1, blob: new Blob([new Uint8Array([0xff,0xd8,0xff])], { type: "image/jpeg" }) }] })
})
it("asks before restoration and restores the selected photo and text without publishing", async () => {
  const user = userEvent.setup()
  render(<CreateListingWizard {...props} />)
  expect(await screen.findByRole("button", { name: "მონახაზის აღდგენა" })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "მონახაზის აღდგენა" }))
  expect(URL.createObjectURL).toHaveBeenCalledOnce()
  await user.click(screen.getByRole("button", { name: "გაგრძელება →" }))
  expect(screen.getByLabelText(/^რას ყიდი/)).toHaveValue("შენახული ქურთუკი")
  expect(screen.getByLabelText(/^აღწერა/)).toHaveValue("კარგ მდგომარეობაშია.")
  expect(screen.getByLabelText(/^კატეგორია/)).toHaveValue("1")
})
it("allows discarding the old draft instead of restoring it", async () => {
  const user = userEvent.setup()
  render(<CreateListingWizard {...props} />)
  await user.click(await screen.findByRole("button", { name: "მონახაზის წაშლა" }))
  expect(deleteListingDraft).toHaveBeenCalledWith("owner-a")
  expect(screen.queryByRole("button", { name: "მონახაზის აღდგენა" })).not.toBeInTheDocument()
})

function blocksReload() {
  const event = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

it("explains disabled autosave and protects selected photos without storing them", async () => {
  saveBrowserConsent(false, false)
  const user = userEvent.setup()
  render(<CreateListingWizard {...props} />)
  expect(screen.getByRole("status")).toHaveTextContent("ავტოშენახვა გამორთულია")
  expect(blocksReload()).toBe(false)
  await user.upload(screen.getByLabelText("განცხადების სურათების არჩევა"),
    new File([new Uint8Array([0xff, 0xd8, 0xff])], "item.jpg", { type: "image/jpeg" }))
  await waitFor(() => expect(blocksReload()).toBe(true))
  expect(saveListingDraft).not.toHaveBeenCalled()
  expect(readListingDraft).not.toHaveBeenCalled()
})

it("keeps protection until the latest photo/text save succeeds and restores it on edits", async () => {
  vi.mocked(readListingDraft).mockResolvedValue(null)
  let finishSave!: (value: boolean) => void
  vi.mocked(saveListingDraft).mockImplementation(() => new Promise<boolean>((resolve) => { finishSave = resolve }))
  const user = userEvent.setup()
  render(<CreateListingWizard {...props} />)
  await user.upload(screen.getByLabelText("განცხადების სურათების არჩევა"),
    new File([new Uint8Array([0xff, 0xd8, 0xff])], "item.jpg", { type: "image/jpeg" }))
  await waitFor(() => expect(saveListingDraft).toHaveBeenCalled(), { timeout: 2000 })
  expect(blocksReload()).toBe(true)
  await act(async () => finishSave(true))
  expect(screen.getByRole("status")).toHaveTextContent("შენახულია ამ ბრაუზერში")
  expect(blocksReload()).toBe(false)
  await user.click(screen.getByRole("button", { name: "გაგრძელება →" }))
  await user.type(screen.getByLabelText(/^რას ყიდი/), "ქურთუკი")
  expect(blocksReload()).toBe(true)
})

it("keeps protection and shows an error if local storage fails", async () => {
  vi.mocked(readListingDraft).mockResolvedValue(null)
  vi.mocked(saveListingDraft).mockRejectedValue(new Error("quota"))
  const user = userEvent.setup()
  render(<CreateListingWizard {...props} />)
  await user.upload(screen.getByLabelText("განცხადების სურათების არჩევა"),
    new File([new Uint8Array([0xff, 0xd8, 0xff])], "item.jpg", { type: "image/jpeg" }))
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ავტოშენახვა ვერ მოხერხდა"), { timeout: 2000 })
  expect(blocksReload()).toBe(true)
})
