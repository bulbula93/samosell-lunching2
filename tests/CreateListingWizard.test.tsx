import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CreateListingWizard from "@/components/dashboard/CreateListingWizard"

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), save: vi.fn(), abort: vi.fn(), upload: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("@/app/dashboard/listings/form-actions", () => ({
  prepareListingUploadsAction: mocks.prepare,
  saveListingAction: mocks.save,
  abortListingUploadsAction: mocks.abort,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: mocks.upload }) } }),
}))

const props = {
  categories: [{ id: 1, slug: "women", name: "ქალებისთვის" }],
  brands: [],
  sizes: [],
  initialSellerPhone: "+995 555 12 34 56",
}

async function fillWizard(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText("განცხადების სურათების არჩევა"),
    new File([new Uint8Array([0xff, 0xd8, 0xff])], "item.jpg", { type: "image/jpeg" }))
  await user.click(screen.getByRole("button", { name: "გაგრძელება →" }))
  await user.type(screen.getByLabelText(/^რას ყიდი/), "ტყავის ქურთუკი")
  await user.selectOptions(screen.getByLabelText(/^კატეგორია/), "1")
  await user.type(screen.getByLabelText(/^აღწერა/), "კარგ მდგომარეობაშია და დეფექტი არ აქვს.")
  await user.click(screen.getByRole("button", { name: "გაგრძელება →" }))
  await user.type(screen.getByLabelText(/^ფასი/), "120")
  await user.click(screen.getByRole("button", { name: "გაგრძელება →" }))
}

describe("CreateListingWizard", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.prepare.mockImplementation(async (input: { listingId: string; files: Array<{ clientId: string }> }) => ({
      ok: true, listingId: input.listingId,
      plans: input.files.map((file) => ({ clientId: file.clientId, path: `user/${input.listingId}/${file.clientId}.jpg`, token: "test-token" })),
    }))
    mocks.save.mockImplementation(async (input: { listingId: string }) => ({ ok: true, listingId: input.listingId, slug: "test-listing", status: "active", cleanupWarning: false }))
    mocks.upload.mockResolvedValue({ error: null })
    Element.prototype.scrollIntoView = vi.fn()
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:listing-preview"),
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    })
  })

  it.each(["transport", "server_error"])("retries the exact create after %s failure without uploading or aborting again", async (failure) => {
    const user = userEvent.setup()
    if (failure === "transport") mocks.save.mockRejectedValueOnce(new Error("lost response"))
    else mocks.save.mockResolvedValueOnce({ ok: false, code: "server_error", message: "სცადე ხელახლა." })
    render(<CreateListingWizard {...props} />)
    await fillWizard(user)
    await user.click(screen.getByRole("button", { name: "განცხადების გამოქვეყნება" }))
    await screen.findByRole("alert")
    const firstInput = mocks.save.mock.calls[0][0]
    await user.click(screen.getByRole("button", { name: "განცხადების გამოქვეყნება" }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2))
    expect(mocks.save.mock.calls[1][0]).toBe(firstInput)
    expect(firstInput.listingId).toBe(mocks.prepare.mock.calls[0][0].listingId)
    expect(mocks.prepare).toHaveBeenCalledOnce()
    expect(mocks.upload).toHaveBeenCalledOnce()
    expect(mocks.abort).not.toHaveBeenCalled()
    expect(await screen.findByRole("heading", { name: /განცხადება გამოქვეყნდა/ })).toBeInTheDocument()
  })

  it("keeps the attempt ID after a lost preparation response", async () => {
    const user = userEvent.setup()
    mocks.prepare.mockRejectedValueOnce(new Error("response lost"))
    render(<CreateListingWizard {...props} />)
    await fillWizard(user)
    await user.click(screen.getByRole("button", { name: "განცხადების გამოქვეყნება" }))
    await screen.findByRole("alert")
    await user.click(screen.getByRole("button", { name: "განცხადების გამოქვეყნება" }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(mocks.prepare.mock.calls[1][0].listingId).toBe(mocks.prepare.mock.calls[0][0].listingId)
    expect(mocks.save.mock.calls[0][0].listingId).toBe(mocks.prepare.mock.calls[0][0].listingId)
  })

  it("starts with camera and photo-library actions in a four-step flow", () => {
    render(<CreateListingWizard {...props} />)

    expect(screen.getByText("1/4 · ფოტოები")).toBeInTheDocument()
    expect(screen.getByLabelText("კამერით ფოტოს გადაღება")).toHaveAttribute(
      "capture",
      "environment",
    )
    expect(screen.getByRole("button", { name: /კამერით გადაღება/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /გალერეიდან არჩევა/ })).toBeInTheDocument()
  })

  it("moves through photos, details, price, and preview without uploading early", async () => {
    const user = userEvent.setup()
    render(<CreateListingWizard {...props} />)

    await user.upload(
      screen.getByLabelText("განცხადების სურათების არჩევა"),
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "item.jpg", { type: "image/jpeg" }),
    )
    await user.click(screen.getByRole("button", { name: "გაგრძელება →" }))

    expect(screen.getByRole("heading", { name: "2. რა ნივთს ყიდი?" })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^რას ყიდი/), "ტყავის ქურთუკი")
    await user.selectOptions(screen.getByLabelText(/^კატეგორია/), "1")
    await user.type(
      screen.getByLabelText(/^აღწერა/),
      "კარგ მდგომარეობაშია და დეფექტი არ აქვს.",
    )
    await user.click(screen.getByRole("button", { name: "გაგრძელება →" }))

    expect(
      screen.getByRole("heading", { name: "3. ფასი და გაყიდვის ტიპი" }),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^ფასი/), "120")
    await user.click(screen.getByRole("button", { name: "გაგრძელება →" }))

    expect(
      screen.getByRole("heading", { name: /Preview — ასე გამოჩნდება განცხადება/ }),
    ).toBeInTheDocument()
    expect(screen.getByText("4/4 · Preview")).toBeInTheDocument()
  })

  it("keeps the user on the first step until at least one image is selected", async () => {
    const user = userEvent.setup()
    render(<CreateListingWizard {...props} />)

    const input = screen.getByLabelText("განცხადების სურათების არჩევა")
    expect(input).toBeRequired()

    await user.click(screen.getByRole("button", { name: "გაგრძელება →" }))

    expect(screen.getByText("დაამატე მინიმუმ ერთი ფოტო.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /1\. დაამატე ფოტოები/ })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "განცხადების დეტალები" })).not.toBeInTheDocument()
  })
})
