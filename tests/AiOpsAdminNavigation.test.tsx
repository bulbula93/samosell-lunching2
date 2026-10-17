import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DashboardHeader from "@/components/dashboard/DashboardHeader"

vi.mock("@/components/dashboard/SignOutButton", () => ({ default: () => <button>გასვლა</button> }))

describe("AI Operations QA admin navigation", () => {
  it("offers the stable protected QA destination in desktop and mobile admin menus", () => {
    render(<DashboardHeader isAdmin />)
    const links = screen.getAllByRole("link", { name: "AI Operations · QA — ახალ ჩანართში გახსნა" })
    expect(links).toHaveLength(3)
    for (const link of links) {
      expect(link).toHaveAttribute("href", "https://samosell-lunching2-git-prev-f37447-giorgibulbula-6265s-projects.vercel.app/admin/ai")
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", "noopener noreferrer")
    }
  })

  it("does not expose admin navigation to regular users", () => {
    render(<DashboardHeader />)
    expect(screen.queryByRole("link", { name: /AI Operations/ })).not.toBeInTheDocument()
  })
})
