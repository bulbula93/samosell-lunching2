import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import CreateListingWizard from "@/components/dashboard/CreateListingWizard"
import { saveBrowserConsent } from "@/lib/browser-preferences"
import { readListingDraft, deleteListingDraft } from "@/lib/listing-draft"
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("@/app/dashboard/listings/form-actions", () => ({ prepareListingUploadsAction: vi.fn(), saveListingAction: vi.fn(), abortListingUploadsAction: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: vi.fn() } }) }))
vi.mock("@/lib/listing-draft", () => ({ readListingDraft: vi.fn(), saveListingDraft: vi.fn(() => Promise.resolve(true)), deleteListingDraft: vi.fn(() => Promise.resolve()) }))
const props = { categories: [{ id: 1, name: "ქალებისთვის", slug: "women" }], brands: [], sizes: [], initialSellerPhone: "+995 555 12 34 56", userId: "owner-a" }
beforeEach(() => {
  localStorage.clear(); document.cookie = "samosell_browser_consent=; Max-Age=0; Path=/"; vi.clearAllMocks(); saveBrowserConsent(true, false)
  Element.prototype.scrollIntoView = vi.fn()
  URL.createObjectURL = vi.fn(() => "blob:restored")
  URL.revokeObjectURL = vi.fn()
  vi.mocked(readListingDraft).mockResolvedValue({ userId: "owner-a", updatedAt: Date.now(), sizeType: "clothing",
    fields: { title: "შენახული ქურთუკი", description: "კარგ მდგომარეობაშია.", price: "25", categoryId: 1, brandId: "", sizeId: "", condition: "good", saleType: "sell", gender: "unisex", color: "", material: "", city: "თბილისი", publishNow: true },
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
