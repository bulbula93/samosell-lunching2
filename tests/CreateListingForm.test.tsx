import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CreateListingForm from "@/components/dashboard/CreateListingForm"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  prepare: vi.fn(),
  save: vi.fn(),
  abort: vi.fn(),
  upload: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

vi.mock("@/app/dashboard/listings/form-actions", () => ({
  prepareListingUploadsAction: mocks.prepare,
  saveListingAction: mocks.save,
  abortListingUploadsAction: mocks.abort,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        uploadToSignedUrl: mocks.upload,
      }),
    },
  }),
}))

const props = {
  categories: [{ id: 1, name: "ტანსაცმელი" }],
  brands: [{ id: "177f3329-6c04-4c40-8f33-873ab3ee4f76", name: "Zara" }],
  sizes: [{ id: "277f3329-6c04-4c40-8f33-873ab3ee4f76", label: "M" }],
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^სათაური/), "ტყავის ქურთუკი")
  await user.type(screen.getByLabelText(/^აღწერა/), "კარგ მდგომარეობაშია და დეფექტი არ აქვს.")
  await user.type(screen.getByRole("textbox", { name: /^ფასი/ }), "120.50")
  await user.selectOptions(screen.getByLabelText(/^კატეგორია/), "1")
}

describe("CreateListingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prepare.mockResolvedValue({
      ok: true,
      listingId: "377f3329-6c04-4c40-8f33-873ab3ee4f76",
      plans: [],
    })
    mocks.save.mockResolvedValue({
      ok: true,
      listingId: "377f3329-6c04-4c40-8f33-873ab3ee4f76",
      slug: "tyavis-kurtuki",
      status: "active",
      cleanupWarning: false,
    })
    mocks.upload.mockResolvedValue({ error: null })
  })

  it("renders associated labels, real lookup options, and accessible image input", () => {
    render(<CreateListingForm {...props} />)

    expect(screen.getByRole("heading", { name: "გაყიდე ნივთი მარტივად" })).toBeInTheDocument()
    expect(screen.getByLabelText(/^სათაური/)).toBeRequired()
    expect(screen.getByLabelText(/^კატეგორია/)).toContainHTML("ტანსაცმელი")
    expect(screen.getByLabelText("განცხადების სურათების არჩევა")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp"
    )
  })

  it("shows field-level errors and focuses the error summary", async () => {
    const user = userEvent.setup()
    render(<CreateListingForm {...props} />)

    await user.click(screen.getByRole("button", { name: "გამოქვეყნება" }))

    expect(screen.getByRole("alert")).toHaveFocus()
    expect(screen.getByText(/სათაური უნდა შეიცავდეს/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^სათაური/)).toHaveAttribute("aria-invalid", "true")
    expect(mocks.prepare).not.toHaveBeenCalled()
  })

  it("rejects unsupported files and more than eight images before upload", async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<CreateListingForm {...props} />)
    const input = screen.getByLabelText("განცხადების სურათების არჩევა")

    await user.upload(input, new File(["<svg/>"], "vector.svg", { type: "image/svg+xml" }))
    expect(input).toHaveAccessibleDescription(/ატვირთე მხოლოდ JPEG, PNG ან WEBP/)

    const files = Array.from(
      { length: 9 },
      (_, index) => new File(["image"], `item-${index}.jpg`, { type: "image/jpeg" })
    )
    await user.upload(input, files)
    expect(input).toHaveAccessibleDescription(/მაქსიმუმ 8 სურათის/)
  })

  it("creates an active listing once and opens its real detail route", async () => {
    const user = userEvent.setup()
    render(<CreateListingForm {...props} />)
    await fillValidForm(user)

    await user.dblClick(screen.getByRole("button", { name: "გამოქვეყნება" }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(mocks.prepare).toHaveBeenCalledOnce()
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "create",
        form: expect.objectContaining({ title: "ტყავის ქურთუკი", publishNow: true }),
      })
    )
    expect(mocks.push).toHaveBeenCalledWith("/listing/tyavis-kurtuki")
  })

  it("keeps form data and cleans uploaded objects when upload fails", async () => {
    const user = userEvent.setup()
    const listingId = "377f3329-6c04-4c40-8f33-873ab3ee4f76"
    const firstPath = `user/${listingId}/477f3329-6c04-4c40-8f33-873ab3ee4f76.jpg`
    const secondPath = `user/${listingId}/577f3329-6c04-4c40-8f33-873ab3ee4f76.jpg`
    mocks.prepare.mockImplementation(async (input: { files: Array<{ clientId: string }> }) => ({
      ok: true,
      listingId,
      plans: input.files.map((file, index) => ({
        clientId: file.clientId,
        path: index === 0 ? firstPath : secondPath,
        token: `signed-token-${index}`,
      })),
    }))
    mocks.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("network internals") })

    render(<CreateListingForm {...props} />)
    await fillValidForm(user)
    await user.upload(
      screen.getByLabelText("განცხადების სურათების არჩევა"),
      [
        new File([new Uint8Array([0xff, 0xd8, 0xff])], "item-1.jpg", { type: "image/jpeg" }),
        new File([new Uint8Array([0xff, 0xd8, 0xff])], "item-2.jpg", { type: "image/jpeg" }),
      ],
    )

    await user.click(screen.getByRole("button", { name: "გამოქვეყნება" }))

    expect(await screen.findByText(/სურათის ატვირთვა ვერ დასრულდა/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^სათაური/)).toHaveValue("ტყავის ქურთუკი")
    expect(mocks.abort).toHaveBeenCalledWith(listingId, [firstPath])
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("prefills edit data, preserves protected statuses, and links back by slug", () => {
    render(
      <CreateListingForm
        {...props}
        mode="edit"
        initialData={{
          id: "377f3329-6c04-4c40-8f33-873ab3ee4f76",
          slug: "reserved-jacket",
          title: "დაჯავშნილი ქურთუკი",
          description: "საკმარისად გრძელი არსებული აღწერა.",
          price: "90.00",
          category_id: 1,
          brand_id: "",
          size_id: "",
          condition: "good",
          sale_type: "sell",
          gender: "unisex",
          color: "",
          material: "",
          city: "თბილისი",
          status: "reserved",
          published_at: "2026-08-01T00:00:00.000Z",
          images: [],
        }}
      />
    )

    expect(screen.getByRole("heading", { name: "განცხადების რედაქტირება" })).toBeInTheDocument()
    expect(screen.getByLabelText(/^სათაური/)).toHaveValue("დაჯავშნილი ქურთუკი")
    expect(screen.getByText("დარეზერვებული")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "გამოქვეყნდება" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "გაუქმება" })).toHaveAttribute(
      "href",
      "/listing/reserved-jacket"
    )
  })
})
