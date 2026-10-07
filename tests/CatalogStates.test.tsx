import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import CatalogError from "@/app/catalog/error"
import CatalogLoading from "@/app/catalog/loading"
import CatalogLandingFilters from "@/components/listings/CatalogLandingFilters"
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

  it("eager-loads only the first catalog image for the mobile LCP candidate", () => {
    render(
      <CatalogResultsGrid
        listings={[
          makeListing({ id: "first", cover_image_url: "/first.jpg" }),
          makeListing({ id: "second", cover_image_url: "/second.jpg" }),
        ]}
        currentPath="/catalog"
        favoriteIds={[]}
      />,
    )

    const images = screen.getAllByRole("img")
    expect(images[0]).toHaveAttribute("loading", "eager")
    expect(images[0]).toHaveAttribute("fetchpriority", "high")
    expect(images[0]).not.toHaveClass("opacity-0")
    expect(images[1]).toHaveAttribute("loading", "lazy")
    expect(images[1]).toHaveAttribute("fetchpriority", "auto")
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

  it("preserves the routed category while allowing search and item filters to be removed", () => {
    render(
      <CatalogLandingFilters
        categories={[{ slug: "women", name: "ქალებისთვის" }]}
        sizes={[]}
        colors={[]}
        cities={[]}
        values={{
          q: "კაბა",
          category: "women",
          item_type: "dresses",
          brand: "",
          size: "",
          color: "",
          city: "",
          condition: "",
          gender: "",
          vip: "",
          sort: "price_asc",
          min_price: "",
          max_price: "",
        }}
      />,
    )

    expect(screen.getByRole("link", { name: "ძებნა: კაბა ფილტრის მოხსნა" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "ქალებისთვის ფილტრის მოხსნა" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "კაბები ფილტრის მოხსნა" })).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "კატეგორია" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "კაბები ფილტრის მოხსნა" })).toHaveAttribute("href", "/catalog/women?q=%E1%83%99%E1%83%90%E1%83%91%E1%83%90&sort=price_asc")
    expect(screen.getAllByRole("button", { name: /^კაბები/ }).length).toBeGreaterThan(0)
  })
})
