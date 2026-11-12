import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import FacebookCommunityShare from "@/components/listings/FacebookCommunityShare"
import ListingSocialShare from "@/components/listings/ListingSocialShare"
import { normalizeFacebookGroupUrl } from "@/lib/facebook-community"
import { trackListingShare } from "@/lib/growth/client"

vi.mock("@/lib/growth/client", () => ({ trackListingShare: vi.fn() }))
const props = { listingId: "11111111-1111-4111-8111-111111111111", url: "https://samosell.ge/listing/test-123", text: "ქურთუკი · M · 45 ₾\nახალი · თბილისი" }
// Deliberately synthetic test destination. No real group is configured by this feature.
const groupUrl = "https://www.facebook.com/groups/test-fixture/"
beforeEach(() => vi.clearAllMocks())

describe("Facebook community sharing", () => {
  it("leaves an unconfigured group unavailable while keeping copy actions usable", () => {
    render(<FacebookCommunityShare {...props} />)
    expect(screen.queryByRole("link", { name: "ჯგუფის გახსნა" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "ბმულის კოპირება" })).toBeEnabled()
    expect(screen.getByText(/ჯგუფის ბმული ჯერ მითითებული/)).toBeInTheDocument()
  })
  it("copies the complete Georgian post or canonical link and records only successful copies", async () => {
    const user = userEvent.setup()
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    render(<FacebookCommunityShare {...props} groupUrl={groupUrl} />)
    await user.click(screen.getByRole("button", { name: "ტექსტის კოპირება" }))
    expect(write).toHaveBeenLastCalledWith(`${props.text}\n\n${props.url}`)
    expect(trackListingShare).toHaveBeenLastCalledWith(props.listingId, "post_copied")
    await user.click(screen.getByRole("button", { name: "ბმულის კოპირება" }))
    expect(write).toHaveBeenLastCalledWith(props.url)
    expect(trackListingShare).toHaveBeenLastCalledWith(props.listingId, "link_copied")
    const group = screen.getByRole("link", { name: "ჯგუფის გახსნა" })
    expect(group).toHaveAttribute("href", groupUrl)
    expect(group).toHaveAttribute("rel", "noopener noreferrer")
    fireEvent.click(group)
    expect(trackListingShare).toHaveBeenLastCalledWith(props.listingId, "group_open_clicked")
    expect(screen.queryByText(/^გაზიარებულია$/)).not.toBeInTheDocument()
  })
  it("offers selectable manual text when clipboard is denied or unavailable", async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("denied", "NotAllowedError"))
    render(<FacebookCommunityShare {...props} />)
    await user.click(screen.getByRole("button", { name: "ტექსტის კოპირება" }))
    const text = screen.getByRole("textbox", { name: "ხელით დასაკოპირებელი ტექსტი" })
    expect(text).toHaveValue(`${props.text}\n\n${props.url}`)
    expect(text).toHaveAttribute("readonly")
    expect(trackListingShare).not.toHaveBeenCalled()
  })
  it("opens Facebook via a normal link and records a click, never a confirmed post", () => {
    render(<ListingSocialShare {...props} title="ქურთუკი" priceText="45 ₾" />)
    const link = screen.getByRole("link", { name: "Facebook-ზე გაზიარება" })
    const destination = new URL(link.getAttribute("href")!)
    expect(destination.origin).toBe("https://www.facebook.com")
    expect(destination.searchParams.get("u")).toBe(props.url)
    fireEvent.click(link)
    expect(trackListingShare).toHaveBeenCalledExactlyOnceWith(props.listingId, "facebook_share_clicked")
    expect(screen.queryByText(/^გაზიარებულია$/)).not.toBeInTheDocument()
  })
  it.each(["javascript:alert(1)", "https://facebook.com.evil.test/groups/test/", "https://www.facebook.com/samosell.ge", "https://www.facebook.com/groups/test/posts/123/", "https://user@facebook.com/groups/test/", "http://facebook.com/groups/test/", "https://facebook.com/groups/test\\evil", "https://facebook.com/groups/te%73t/"])("rejects unsafe or non-group destinations: %s", (url) => {
    expect(normalizeFacebookGroupUrl(url)).toBeNull()
  })
  it("normalizes mobile group links and removes tracking parameters", () => {
    expect(normalizeFacebookGroupUrl(" https://m.facebook.com/groups/test-fixture?ref=share#about ")).toBe(groupUrl)
  })
})
