import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import MarketplaceSearch from "@/components/layout/MarketplaceSearch"

describe("marketplace search state", () => {
  beforeEach(() => window.localStorage.clear())

  it("preserves edits across rerenders and resets on a changed route query", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<MarketplaceSearch defaultValue="coat" />)
    const input = screen.getByRole("searchbox")
    await user.type(input, " vintage")
    rerender(<MarketplaceSearch defaultValue="coat" />)
    expect(input).toHaveValue("coat vintage")
    rerender(<MarketplaceSearch defaultValue="dress" />)
    expect(input).toHaveValue("dress")
  })

  it("reads fresh recent searches on focus, including changes after mount", () => {
    render(<MarketplaceSearch />)
    window.localStorage.setItem("samosell:recent-searches", JSON.stringify(["unique recent coat"]))
    fireEvent.focus(screen.getByRole("searchbox"))
    expect(screen.getByRole("link", { name: /unique recent coat/ })).toHaveAttribute("href", "/catalog?q=unique%20recent%20coat")
    fireEvent.blur(screen.getByRole("searchbox"))
    window.localStorage.setItem("samosell:recent-searches", JSON.stringify(["fresh dress"]))
    fireEvent.focus(screen.getByRole("searchbox"))
    expect(screen.queryByRole("link", { name: /unique recent coat/ })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /fresh dress/ })).toBeInTheDocument()
  })

  it("remains usable when recent-search storage is invalid", () => {
    window.localStorage.setItem("samosell:recent-searches", "invalid json")
    render(<MarketplaceSearch />)
    fireEvent.focus(screen.getByRole("searchbox"))
    expect(screen.getByRole("searchbox")).toHaveValue("")
  })
})
