import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import EditListingNotFound from "@/app/dashboard/listings/[id]/edit/not-found"
import NewListingLoading from "@/app/dashboard/listings/new/loading"
import ListingFormError from "@/components/dashboard/ListingFormError"

describe("listing form route states", () => {
  it("announces the loading skeleton", () => {
    render(<NewListingLoading />)
    expect(screen.getByRole("main", { name: "ფორმა იტვირთება" })).toHaveAttribute(
      "aria-busy",
      "true"
    )
    expect(screen.getByRole("status")).toHaveTextContent("განცხადების ფორმა იტვირთება")
  })

  it("renders a private-safe edit not-found state", () => {
    render(<EditListingNotFound />)
    expect(screen.getByRole("heading", { name: "განცხადება ვერ მოიძებნა" })).toBeInTheDocument()
    expect(screen.getByText(/არ არსებობს ან მისი რედაქტირების უფლება არ გაქვს/)).toBeInTheDocument()
  })

  it("lets the user retry a lookup failure without exposing raw server details", async () => {
    const reset = vi.fn()
    render(<ListingFormError reset={reset} />)

    expect(screen.getByRole("alert")).not.toHaveTextContent("database")
    await userEvent.click(screen.getByRole("button", { name: "ხელახლა ცდა" }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
