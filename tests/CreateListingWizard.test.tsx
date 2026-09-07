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
