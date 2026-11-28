import { render } from "@testing-library/react"
import { expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => { vi.spyOn(Math, "random").mockReturnValue(0.5); return { hook: vi.fn() } })
vi.mock("next/web-vitals", () => ({ useReportWebVitals: mocks.hook }))
vi.mock("@/lib/browser-preferences", () => ({ allowsAnalytics: () => true }))

it("does not send metrics from documents outside the 20% sample", async () => {
  const { default: FieldWebVitals, WEB_VITALS_SAMPLE_RATE } = await import("@/components/shared/FieldWebVitals")
  expect(WEB_VITALS_SAMPLE_RATE).toBe(0.2)
  history.replaceState(null, "", "/catalog/women")
  const sendBeacon = vi.fn().mockReturnValue(true)
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: sendBeacon })
  render(<FieldWebVitals />)
  mocks.hook.mock.calls.at(-1)![0]({ id: "x", name: "LCP", value: 1200, rating: "good", delta: 1200, entries: [], navigationType: "navigate" })
  expect(sendBeacon).not.toHaveBeenCalled()
})
