import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import CatalogLandingFilters from "@/components/listings/CatalogLandingFilters"
import type { CatalogFilterValues } from "@/components/listings/CatalogFilterFields"

const options = { categories: [{ slug: "women", name: "ქალებისთვის" }], sizes: [], colors: ["შავი"], cities: ["თბილისი"] }
const values: CatalogFilterValues = {
  q: "კაბა", category: "women", item_type: "dresses", brand: "Zara", size: "", color: "", city: "",
  condition: "like_new", gender: "", vip: "", sort: "price_asc", min_price: "10", max_price: "80",
}

describe("catalog filter UX", () => {
  it("uses readable condition chips and the same contextual reset on mobile and desktop", async () => {
    const user = userEvent.setup()
    render(<CatalogLandingFilters {...options} values={values} />)
    expect(screen.getByRole("link", { name: "თითქმის ახალი ფილტრის მოხსნა" })).toBeInTheDocument()
    // Search is a separate chip; it is not counted as an item filter.
    const trigger = screen.getByRole("button", { name: /ფილტრები 4 აქტიური/ })
    await user.click(trigger)
    const dialog = screen.getByRole("dialog", { name: "ფილტრები" })
    expect(within(dialog).getByText("ქალებისთვის")).toBeInTheDocument()
    const resetLinks = screen.getAllByRole("link", { name: "გასუფთავება" })
    expect(resetLinks).toHaveLength(2)
    for (const link of resetLinks) expect(link).toHaveAttribute("href", "/catalog/women?q=%E1%83%99%E1%83%90%E1%83%91%E1%83%90")
    expect(within(dialog).getByRole("button", { name: "თითქმის ახალი", pressed: true })).toBeInTheDocument()
    const form = dialog.querySelector("form")!
    expect(new FormData(form).get("sort")).toBe("price_asc")
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(document.body.style.overflow).not.toBe("hidden")
  })

  it("returns focus to a named filter after selection and closes its menu before the drawer", async () => {
    const user = userEvent.setup()
    render(<CatalogLandingFilters {...options} values={values} />)
    await user.click(screen.getByRole("button", { name: /ფილტრები 4 აქტიური/ }))
    const dialog = screen.getByRole("dialog")
    const city = within(dialog).getByText("ყველა ქალაქი", { selector: "summary span[id]" }).closest("summary")!
    expect(city).toHaveAccessibleName("მდებარეობა ყველა ქალაქი")
    await user.click(city)
    await user.click(within(dialog).getByRole("button", { name: "თბილისი" }))
    expect(city).toHaveFocus()
    expect(city).toHaveAccessibleName("მდებარეობა თბილისი")
    expect(new FormData(dialog.querySelector("form")!).get("city")).toBe("თბილისი")
    await user.click(city)
    // jsdom does not consistently focus native summary elements on click.
    fireEvent.keyDown(city, { key: "Escape" })
    expect(city.closest("details")).not.toHaveAttribute("open")
    expect(dialog).toBeInTheDocument()
    await user.click(city)
    // Also cover a native document listener running before React's handler.
    fireEvent.keyDown(document, { key: "Escape" })
    expect(city.closest("details")).not.toHaveAttribute("open")
    expect(dialog).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows perfume-specific condition text and does not count the search as a filter", () => {
    render(<CatalogLandingFilters {...options} values={{ ...values, category: "perfume", item_type: "", brand: "", condition: "good", min_price: "", max_price: "" }} />)
    expect(screen.getByRole("link", { name: "გამოყენებული ფილტრის მოხსნა" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /ფილტრები 1 აქტიური/ })).toBeInTheDocument()
  })
})
