import { act, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import OptionalAnalytics from "@/components/privacy/OptionalAnalytics"
import { saveBrowserConsent } from "@/lib/browser-preferences"
vi.mock("next/script", () => ({ default: ({ id, src }: { id: string; src?: string }) => <span data-testid={id} data-src={src} /> }))
vi.mock("@/components/shared/FieldWebVitals", () => ({ default: () => <span data-testid="vitals" /> }))
beforeEach(() => { localStorage.clear(); document.cookie = "samosell_browser_consent=; Max-Age=0; Path=/" })
it("mounts no optional scripts before consent and only mounts them with analytics enabled", () => {
  render(<OptionalAnalytics />)
  expect(screen.queryByTestId("top-ge-counter")).not.toBeInTheDocument()
  act(() => saveBrowserConsent(true, false))
  expect(screen.queryByTestId("vitals")).not.toBeInTheDocument()
  act(() => saveBrowserConsent(false, true))
  expect(screen.getByTestId("top-ge-counter")).toHaveAttribute("data-src", "https://counter.top.ge/counter.js")
  expect(screen.getByTestId("vitals")).toBeInTheDocument()
  act(() => saveBrowserConsent(false, false))
  expect(screen.queryByTestId("vercel-speed-insights")).not.toBeInTheDocument()
})
