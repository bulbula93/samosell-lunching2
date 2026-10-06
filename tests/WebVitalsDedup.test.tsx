import { render, cleanup } from "@testing-library/react"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import FieldWebVitals from "@/components/shared/FieldWebVitals"

const mocks = vi.hoisted(() => ({ hook: vi.fn(), allowed: vi.fn() }))
vi.mock("next/web-vitals", () => ({ useReportWebVitals: mocks.hook }))
vi.mock("@/lib/browser-preferences", () => ({ allowsAnalytics: mocks.allowed }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.allowed.mockReturnValue(true)
  history.replaceState(null, "", "/catalog/women")
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: vi.fn().mockReturnValue(true) })
})
afterEach(cleanup)
const metric = (id: string, value = 1500, name = "LCP") => ({ id, name, value, rating: "good", delta: value, entries: [], navigationType: "navigate" })
it("keeps the observer callback stable across rerenders", () => {
  const hook = render(<FieldWebVitals />)
  const report = mocks.hook.mock.calls[0][0]
  hook.rerender(<FieldWebVitals />)
  expect(mocks.hook.mock.calls.at(-1)![0]).toBe(report)
})
it("suppresses identical metric ids/values across rerenders and remounts but preserves changed CWV and new navigations", () => {
  const hook = render(<FieldWebVitals />)
  let report = mocks.hook.mock.calls.at(-1)![0]
  report(metric("dedup-1")); report(metric("dedup-1"))
  expect(navigator.sendBeacon).toHaveBeenCalledOnce()
  hook.unmount()
  render(<FieldWebVitals />)
  report = mocks.hook.mock.calls.at(-1)![0]
  report(metric("dedup-1"))
  expect(navigator.sendBeacon).toHaveBeenCalledOnce()
  report(metric("dedup-1", 2400)); report(metric("dedup-2", 1500))
  expect(navigator.sendBeacon).toHaveBeenCalledTimes(3)
})
it("keeps all real metrics including zero CLS, while rejecting unsupported, invalid and unconsented events", () => {
  render(<FieldWebVitals />)
  const report = mocks.hook.mock.calls.at(-1)![0]
  for (const name of ["LCP", "INP", "CLS", "FCP", "TTFB"]) report(metric(`valid-${name}`, name === "CLS" ? 0 : 100, name))
  expect(navigator.sendBeacon).toHaveBeenCalledTimes(5)
  report(metric("bad", NaN)); report(metric("negative", -1)); report(metric("unsupported", 20, "FID"))
  mocks.allowed.mockReturnValue(false)
  report(metric("no-consent"))
  expect(navigator.sendBeacon).toHaveBeenCalledTimes(5)
})
