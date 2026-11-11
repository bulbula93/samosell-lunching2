import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useUnsavedListingChanges } from "@/components/dashboard/useUnsavedListingChanges"

const { push, router } = vi.hoisted(() => {
  const push = vi.fn()
  return { push, router: { push } }
})
vi.mock("next/navigation", () => ({ useRouter: () => router }))

function leavingPage() {
  const event = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

function linkTo(href: string) {
  const link = document.createElement("a")
  link.href = href
  document.body.append(link)
  return link
}

beforeEach(() => { push.mockReset() })
afterEach(() => { vi.restoreAllMocks(); document.querySelectorAll("a").forEach((link) => link.remove()) })

describe("unsaved listing protection", () => {
  it("protects reload/close only while changes are unsaved and cleans up on unmount", () => {
    const { rerender, unmount } = renderHook(({ unsaved }) => useUnsavedListingChanges(unsaved), { initialProps: { unsaved: false } })
    expect(leavingPage()).toBe(false)
    rerender({ unsaved: true })
    expect(leavingPage()).toBe(true)
    rerender({ unsaved: false })
    expect(leavingPage()).toBe(false)
    rerender({ unsaved: true })
    unmount()
    expect(leavingPage()).toBe(false)
  })

  it("keeps the form when leaving is declined, then navigates once when accepted", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const progress = vi.fn()
    document.addEventListener("click", progress, true)
    renderHook(() => useUnsavedListingChanges(true))
    const link = linkTo("/dashboard/listings")
    const declined = new MouseEvent("click", { bubbles: true, cancelable: true })
    link.dispatchEvent(declined)
    expect(declined.defaultPrevented).toBe(true)
    expect(push).not.toHaveBeenCalled()
    expect(confirm).toHaveBeenCalledOnce()
    expect(progress).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    expect(push).toHaveBeenCalledExactlyOnceWith(new URL("/dashboard/listings", window.location.href).href)
    document.removeEventListener("click", progress, true)
  })

  it.each([
    { href: "#photos", options: {}, target: "" },
    { href: "/catalog", options: { ctrlKey: true }, target: "" },
    { href: "/catalog", options: {}, target: "_blank" },
    { href: "https://example.com", options: {}, target: "" },
  ])("allows a non-destructive or native link: $href $target", ({ href, options, target }) => {
    const confirm = vi.spyOn(window, "confirm")
    renderHook(() => useUnsavedListingChanges(true))
    const link = linkTo(href)
    link.target = target
    const reachedLink = vi.fn((event: MouseEvent) => event.preventDefault())
    link.addEventListener("click", reachedLink)
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...options }))
    expect(reachedLink).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})
