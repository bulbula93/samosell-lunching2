import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import MarketplaceHeader from "@/components/layout/MarketplaceHeader"
import { ka } from "@/lib/i18n/ka"

const items = [
  { label: "ქალებისთვის", href: "/catalog?category=women" },
  { label: "ვინტაჟი", href: "/catalog?category=vintage" },
]

describe("MarketplaceHeader", () => {
  it("renders catalog, category, login, and registration links for a guest", () => {
    render(
      <MarketplaceHeader
        items={items}
        userState={{ signedIn: false, profileLabel: "", profileImage: null, isAdmin: false }}
      />,
    )

    expect(screen.getAllByRole("link", { name: ka.nav.catalog }).length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: ka.nav.login })).toHaveAttribute("href", "/login")
    expect(screen.getByRole("link", { name: ka.nav.register })).toHaveAttribute("href", "/register")
    expect(screen.getAllByRole("link", { name: "ქალებისთვის" }).length).toBeGreaterThan(0)
  })

  it("renders account actions from the authenticated state", () => {
    render(
      <MarketplaceHeader
        items={items}
        userState={{
          signedIn: true,
          profileLabel: "ნინო",
          profileImage: null,
          isAdmin: false,
        }}
      />,
    )

    expect(screen.getByRole("link", { name: ka.nav.messages })).toHaveAttribute("href", "/dashboard/chats")
    expect(screen.getByRole("link", { name: ka.nav.favorites })).toHaveAttribute("href", "/dashboard/favorites")
    expect(screen.getByText("ნინო")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: ka.nav.login })).not.toBeInTheDocument()
  })

  it("opens the mobile dialog, closes it with Escape, and restores focus", async () => {
    const user = userEvent.setup()
    render(
      <MarketplaceHeader
        items={items}
        userState={{ signedIn: false, profileLabel: "", profileImage: null, isAdmin: false }}
      />,
    )

    const trigger = screen.getByRole("button", { name: ka.nav.menu })
    await user.click(trigger)
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
