import { act, render, screen } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { hidesMobileBottomNavigation } from "@/components/layout/MobileBottomNavigation"
import { useHideOnScroll } from "@/components/layout/useHideOnScroll"

function Bar() {
  const ref = useRef<HTMLElement>(null)
  const hidden = useHideOnScroll(ref)
  return <header ref={ref} data-testid="bar" data-hidden={hidden ? "true" : "false"}><input aria-label="search" /></header>
}

let phone = true
function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y })
  window.dispatchEvent(new Event("scroll"))
}

beforeEach(() => {
  phone = true
  vi.stubGlobal("matchMedia", vi.fn(() => ({ get matches() { return phone }, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0 })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  scrollTo(0)
})
afterEach(() => vi.unstubAllGlobals())

describe("mobile fixed bars", () => {
  it("hides the bottom nav only on pages with their own bottom action bar", () => {
    expect(hidesMobileBottomNavigation("/listing/guess-kurtuki-49d49c9b")).toBe(true)
    expect(hidesMobileBottomNavigation("/dashboard/listings/new")).toBe(true)
    expect(hidesMobileBottomNavigation("/dashboard/listings/abc/edit")).toBe(true)
    for (const path of ["/", "/catalog", "/dashboard/listings", "/dashboard/listings/abc/promote", "/listing/a/b", "/seller/x"]) {
      expect(hidesMobileBottomNavigation(path)).toBe(false)
    }
  })

  it("header hides when scrolling down past the threshold and returns on scroll up", () => {
    render(<Bar />)
    const bar = screen.getByTestId("bar")
    act(() => scrollTo(100)); expect(bar.dataset.hidden).toBe("false")
    act(() => scrollTo(400)); expect(bar.dataset.hidden).toBe("true")
    act(() => scrollTo(395)); expect(bar.dataset.hidden).toBe("true")
    act(() => scrollTo(300)); expect(bar.dataset.hidden).toBe("false")
    act(() => scrollTo(600)); expect(bar.dataset.hidden).toBe("true")
    act(() => scrollTo(50)); expect(bar.dataset.hidden).toBe("false")
  })

  it("never hides while focus is inside the bar or on desktop", () => {
    render(<Bar />)
    const bar = screen.getByTestId("bar")
    act(() => screen.getByLabelText("search").focus())
    act(() => scrollTo(500)); expect(bar.dataset.hidden).toBe("false")
    act(() => (document.activeElement as HTMLElement).blur())
    phone = false
    act(() => scrollTo(900)); expect(bar.dataset.hidden).toBe("false")
  })

  it("header applies the slide only on phones and only while hidden", () => {
    const header = readFileSync("components/layout/MarketplaceHeader.tsx", "utf8")
    expect(header).toContain('hiddenOnScroll ? "max-md:-translate-y-full" : ""')
    expect(header).toContain("motion-reduce:transition-none")
  })

  it("pages without the nav give its offset back to their own bars", () => {
    const nav = readFileSync("components/layout/MobileBottomNavigation.tsx", "utf8")
    expect(nav).toContain('root.style.setProperty("--mobile-nav-offset", "0px")')
    expect(nav).toContain('root.style.removeProperty("--mobile-nav-offset")')
  })
})
