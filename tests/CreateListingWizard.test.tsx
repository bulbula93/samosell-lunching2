import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CreateListingWizard from "@/components/dashboard/CreateListingWizard"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("@/app/dashboard/listings/form-actions", () => ({
  prepareListingUploadsAction: vi.fn(),
  saveListingAction: vi.fn(),
  abortListingUploadsAction: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: vi.fn() } }),
}))

const props = {
  categories: [{ id: 1, name: "ტანსაცმელი" }],
  brands: [],
  sizes: [],
  initialSellerPhone: "+995 555 12 34 56",
}

describe("CreateListingWizard", () => {
  beforeEach(() => {
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
