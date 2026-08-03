import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ChatsError from "@/app/dashboard/chats/error"
import ChatsLoading from "@/app/dashboard/chats/loading"
import ThreadError from "@/app/dashboard/chats/[chatId]/error"
import ThreadLoading from "@/app/dashboard/chats/[chatId]/loading"
import ThreadNotFound from "@/app/dashboard/chats/[chatId]/not-found"

describe("chat route states", () => {
  it("announces inbox and thread loading states", () => {
    const { unmount } = render(<ChatsLoading />)
    expect(screen.getByRole("status")).toHaveTextContent(
      "შეტყობინებები იტვირთება.",
    )
    unmount()
    render(<ThreadLoading />)
    expect(screen.getByRole("status")).toHaveTextContent("მიმოწერა იტვირთება.")
  })

  it("keeps database details out of error states and exposes retry", () => {
    render(
      <ChatsError
        error={new Error("postgres secret")}
        reset={vi.fn()}
      />,
    )
    expect(screen.getByRole("heading")).toHaveTextContent(
      "შეტყობინებები ვერ გაიხსნა",
    )
    expect(screen.queryByText(/postgres/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "ხელახლა ცდა" })).toBeInTheDocument()
  })

  it("renders the private-safe non-participant not-found state", () => {
    render(<ThreadNotFound />)
    expect(screen.getByRole("heading")).toHaveTextContent(
      "მიმოწერა ვერ მოიძებნა",
    )
    expect(screen.getByText(/მონაწილედ არ ხარ/)).toBeInTheDocument()
  })

  it("renders a thread-specific recoverable error", () => {
    render(
      <ThreadError
        error={new Error("private detail")}
        reset={vi.fn()}
      />,
    )
    expect(screen.getByRole("heading")).toHaveTextContent(
      "მიმოწერა ვერ ჩაიტვირთა",
    )
    expect(
      screen.getByRole("link", { name: "ინბოქსში დაბრუნება" }),
    ).toHaveAttribute("href", "/dashboard/chats")
  })
})
