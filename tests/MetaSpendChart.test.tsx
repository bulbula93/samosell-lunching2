import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import MetaSpendChart from "@/components/growth/MetaSpendChart"

it("switches between stored USD and GEL values and supports selecting a day by keyboard focus", () => {
  const points = [{ date: "2026-10-06", usd: 2, gel: 5 }, { date: "2026-10-07", usd: 4, gel: 10 }]
  render(<MetaSpendChart points={points} fxAvailable />)
  fireEvent.click(screen.getByRole("button", { name: "GEL" }))
  expect(screen.getByRole("img", { name: /დღიური ხარჯი GEL/ })).toBeInTheDocument()
  fireEvent.focus(screen.getByRole("button", { name: "2026-10-06: 5.00 GEL" }))
  expect(screen.getByRole("button", { name: "2026-10-06: 5.00 GEL" })).toHaveAttribute("aria-pressed", "true")
})

it("keeps a zero day visible and resets an unavailable GEL selection after a period change", () => {
  const { rerender } = render(<MetaSpendChart points={[{ date: "2026-10-06", usd: 2, gel: 5 }]} fxAvailable />)
  fireEvent.click(screen.getByRole("button", { name: "GEL" }))
  rerender(<MetaSpendChart points={[{ date: "2026-10-07", usd: 0, gel: null }]} fxAvailable={false} />)
  expect(screen.getByRole("button", { name: "GEL" })).toBeDisabled()
  expect(screen.getByRole("img", { name: /დღიური ხარჯი USD/ })).toBeInTheDocument()
  expect(screen.getByText("ამ პერიოდში ხარჯი არ არის")).toBeVisible()
  expect(screen.getByRole("button", { name: "2026-10-07: 0.00 USD" })).toHaveAttribute("aria-pressed", "true")
})
