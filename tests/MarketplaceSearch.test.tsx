import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import MarketplaceSearch from "@/components/layout/MarketplaceSearch"

const RECENT_SEARCHES_KEY = "samosell:recent-searches"

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

it("keeps an edited query on rerender and updates it when the route query changes", () => {
  const view = render(<MarketplaceSearch defaultValue="Nike" />)
  const input = screen.getByRole("searchbox")
  fireEvent.change(input, { target: { value: "Adidas" } })
  view.rerender(<MarketplaceSearch defaultValue="Nike" />)
  expect(input).toHaveValue("Adidas")
  view.rerender(<MarketplaceSearch defaultValue="Zara" />)
  expect(input).toHaveValue("Zara")
  view.rerender(<MarketplaceSearch defaultValue="" />)
  expect(input).toHaveValue("")
})

it("shows saved searches when opened and clears both the panel and storage", () => {
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(["  saved   query  "]))
  render(<MarketplaceSearch />)
  fireEvent.focus(screen.getByRole("searchbox"))
  expect(screen.getByRole("link", { name: /saved query/ })).toHaveAttribute("href", "/catalog?q=saved%20query")
  fireEvent.click(screen.getByRole("button", { name: "გასუფთავება" }))
  expect(screen.queryByText("saved query")).not.toBeInTheDocument()
  expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull()
})

it("keeps submitted search history in memory when browser storage is blocked", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
  render(<MarketplaceSearch />)
  const input = screen.getByRole("searchbox")
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: "saved query" } })
  fireEvent.submit(screen.getByRole("search"))
  fireEvent.change(input, { target: { value: "" } })
  fireEvent.focus(input)
  expect(screen.getByRole("link", { name: /saved query/ })).toHaveAttribute("href", "/catalog?q=saved%20query")
})
