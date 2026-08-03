import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import CatalogError from "@/app/catalog/error"
import CatalogLoading from "@/app/catalog/loading"
import CatalogResultsGrid from "@/components/listings/CatalogResultsGrid"
import { ka } from "@/lib/i18n/ka"
import { makeListing } from "@/tests/fixtures"

describe("catalog states", () => {
  it("announces loading and renders product skeletons", () => {
    const { container } = render(<CatalogLoading />)

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true")
    expect(screen.getByRole("status")).toHaveTextContent(ka.catalog.title)
    expect(container.querySelectorAll(".ui-skeleton").length).toBeGreaterThan(10)
  })

  it("renders an actionable empty state", () => {
    render(<CatalogResultsGrid listings={[]} currentPath="/catalog?q=none" favoriteIds={[]} />)

    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: ka.catalog.emptyTitle })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: ka.catalog.clear })).toHaveAttribute("href", "/catalog")
  })

  it("renders real results through the reusable product card", () => {
    render(
      <CatalogResultsGrid
        listings={[makeListing()]}
        currentPath="/catalog?sort=latest"
        favoriteIds={["listing-1"]}
      />,
    )

    expect(screen.getByRole("heading", { name: /თეთრეულის ვინტაჟური ქურთუკი/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "რჩეულებიდან ამოშლა" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  it("renders the error state and retries", async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    render(<CatalogError error={new Error("network")} reset={reset} />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: ka.catalog.errorTitle })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: ka.catalog.retry }))
    expect(reset).toHaveBeenCalledOnce()

    errorSpy.mockRestore()
  })
})
