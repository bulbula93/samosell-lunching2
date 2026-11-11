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

  it("moves through suggestions with arrows and dismisses with Escape without losing the query", async () => {
    const user = userEvent.setup()
    render(<MarketplaceSearch />)
    const input = screen.getByRole("searchbox")
    await user.type(input, "Zara")
    const links = screen.getAllByRole("link")
    await user.keyboard("{ArrowDown}")
    expect(links[0]).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    expect(links[1]).toHaveFocus()
    await user.keyboard("{ArrowUp}{ArrowUp}")
    expect(input).toHaveFocus()
    await user.keyboard("{ArrowUp}")
    expect(links.at(-1)).toHaveFocus()
    await user.keyboard("{Escape}")
    expect(input).toHaveFocus()
    expect(input).toHaveValue("Zara")
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute("aria-controls")
    await user.keyboard("{ArrowDown}")
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0)
  })

  it("clears the query in place and closes suggestions when focus leaves search", async () => {
    const user = userEvent.setup()
    render(<><MarketplaceSearch /><button>Outside search</button></>)
    const input = screen.getByRole("searchbox")
    await user.type(input, "Zara")
    await user.click(screen.getByRole("button", { name: "საძიებო ტექსტის გასუფთავება" }))
    expect(input).toHaveValue("")
    expect(input).toHaveFocus()
    expect(screen.queryByRole("button", { name: "საძიებო ტექსტის გასუფთავება" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Outside search" }))
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
