import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import ListingError from "@/app/listing/[slug]/error"
import ListingLoading from "@/app/listing/[slug]/loading"
import ListingNotFound from "@/app/listing/[slug]/not-found"
import { ka } from "@/lib/i18n/ka"
import {
  canRenderListingStatus,
  isValidListingSlug,
} from "@/lib/listing-page"

vi.mock("@/components/layout/SiteHeader", () => ({
  default: () => React.createElement("header", null, "SAMOSELL"),
}))

describe("listing route states", () => {
  it("validates public listing slugs and visibility without leaking private statuses", () => {
    expect(isValidListingSlug("listing-1783955816322")).toBe(true)
    expect(isValidListingSlug("../private")).toBe(false)
    expect(isValidListingSlug("draft/item")).toBe(false)

    expect(canRenderListingStatus("active", false)).toBe(true)
    expect(canRenderListingStatus("reserved", false)).toBe(false)
    expect(canRenderListingStatus("sold", false)).toBe(false)
    expect(canRenderListingStatus("reserved", true)).toBe(true)
    expect(canRenderListingStatus("sold", true)).toBe(true)
    expect(canRenderListingStatus("draft", true)).toBe(false)
    expect(canRenderListingStatus("archived", true)).toBe(false)
  })

  it("announces the route loading state", () => {
    render(<ListingLoading />)
    expect(
      screen.getAllByText(ka.listingDetail.loading).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole("main", { name: ka.listingDetail.loading }),
    ).toHaveAttribute("aria-busy", "true")
  })

  it("renders the private-safe not-found experience", () => {
    render(<ListingNotFound />)
    expect(
      screen.getByRole("heading", { name: ka.listingDetail.notFoundTitle }),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: ka.listingDetail.catalog })).toHaveAttribute(
      "href",
      "/catalog",
    )
  })

  it("renders a recoverable route error", async () => {
    const reset = vi.fn()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    render(<ListingError error={new Error("database offline")} reset={reset} />)

    expect(screen.getByRole("alert")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: ka.catalog.retry }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
