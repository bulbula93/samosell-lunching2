import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import BrowserConsentPanel, { BrowserSettingsButton } from "@/components/privacy/BrowserConsentPanel"
import CatalogPreferences from "@/components/listings/CatalogPreferences"
import { CONSENT_KEY, CONSENT_TTL_MS, allowsAnalytics, allowsPersonalization, parseConsent, saveBrowserConsent, subscribePreferences } from "@/lib/browser-preferences"
import { CATALOG_PREFERENCE_KEY, readCatalogFilters, rememberCatalogFilters } from "@/lib/catalog-preferences"
import { readRecentlyViewedIds, rememberRecentlyViewed } from "@/lib/recently-viewed"

vi.mock("@/lib/listing-draft", () => ({ clearAllListingDrafts: vi.fn(() => Promise.resolve()) }))
const id = "12345678-1234-1234-1234-123456789abc"

beforeEach(() => {
  vi.restoreAllMocks()
  saveBrowserConsent(false, false)
  localStorage.clear()
  document.cookie = "samosell_browser_consent=; Max-Age=0; Path=/"
})

describe("browser consent and preferences", () => {
  it("does not record optional history or filters before consent or after necessary-only", () => {
    rememberRecentlyViewed(id)
    rememberCatalogFilters({ brand: "Zara" })
    expect(localStorage.length).toBe(0)
    saveBrowserConsent(false, false)
    rememberRecentlyViewed(id)
    expect(readRecentlyViewedIds()).toEqual([])
    expect(allowsAnalytics()).toBe(false)
  })

  it("remembers bounded history, ignores search text, and purges data on withdrawal", () => {
    saveBrowserConsent(true, false)
    rememberRecentlyViewed(id)
    rememberRecentlyViewed(id)
    rememberCatalogFilters({ brand: "Zara", q: "private search", page: "2", sort: "price_asc" })
    expect(readRecentlyViewedIds()).toEqual([id])
    expect(readCatalogFilters()).toBe("/catalog?brand=Zara&sort=price_asc")
    saveBrowserConsent(false, false)
    expect(localStorage.getItem(CATALOG_PREFERENCE_KEY)).toBeNull()
    expect(readRecentlyViewedIds()).toEqual([])
  })

  it("rejects expired/malformed decisions and handles unavailable storage", () => {
    expect(parseConsent('{"version":1,"analytics":true}')).toBeNull()
    expect(parseConsent(JSON.stringify({ version: 1, analytics: true, personalization: true,
      updatedAt: Date.now() - CONSENT_TTL_MS - 1 }))).toBeNull()
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    expect(() => saveBrowserConsent(false, false)).not.toThrow()
    expect(allowsPersonalization()).toBe(false)
    expect(() => rememberRecentlyViewed(id)).not.toThrow()
  })

  it("honors withdrawal when consent writes fail but the previous choice can still be read", () => {
    saveBrowserConsent(true, true)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError") })
    saveBrowserConsent(false, false)
    expect(JSON.parse(localStorage.getItem(CONSENT_KEY)!)).toMatchObject({ analytics: true })
    expect(allowsAnalytics()).toBe(false)
    expect(allowsPersonalization()).toBe(false)
  })

  it("accepts a later choice from another tab after a failed storage write", () => {
    saveBrowserConsent(true, true)
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    saveBrowserConsent(false, false)
    setItem.mockRestore()
    const unsubscribe = subscribePreferences(() => undefined)
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: 1, analytics: true, personalization: false, updatedAt: Date.now() }))
    window.dispatchEvent(new StorageEvent("storage", { key: CONSENT_KEY }))
    expect(allowsAnalytics()).toBe(true)
    expect(allowsPersonalization()).toBe(false)
    unsubscribe()
  })

  it("offers a small choice panel, honors necessary-only, and reopens from footer", async () => {
    const user = userEvent.setup()
    render(<><BrowserConsentPanel /><BrowserSettingsButton /></>)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "მხოლოდ აუცილებელი" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(CONSENT_KEY)!)).toMatchObject({ analytics: false, personalization: false })
    await user.click(screen.getByRole("button", { name: "Cookies-ის პარამეტრები" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /კომფორტი/ })).not.toBeChecked()
    await user.click(screen.getByRole("checkbox", { name: /კომფორტი/ }))
    await user.click(screen.getByRole("button", { name: "არჩევანის შენახვა" }))
    expect(allowsPersonalization()).toBe(true)
    expect(allowsAnalytics()).toBe(false)
  })

  it("offers explicit filter restoration and forgets it without redirecting a clean catalog", async () => {
    saveBrowserConsent(true, false)
    rememberCatalogFilters({ city: "თბილისი", sort: "price_asc" })
    const user = userEvent.setup()
    render(<CatalogPreferences values={{ q: "", sort: "latest" }} />)
    expect(screen.getByRole("link", { name: "ბოლო ფილტრების აღდგენა" })).toHaveAttribute("href", readCatalogFilters())
    await user.click(screen.getByRole("button", { name: "დავიწყება" }))
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    act(() => saveBrowserConsent(false, false))
  })
})
