import React from "react"
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  cleanup()
})

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    unoptimized: _unoptimized,
    loader: _loader,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean
    priority?: boolean
    unoptimized?: boolean
    loader?: unknown
  }) => {
    void _fill
    void _priority
    void _unoptimized
    void _loader
    return React.createElement("img", props)
  },
}))

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
    children: React.ReactNode
  }) => React.createElement("a", { href, ...props }, children),
}))

vi.mock("@/components/favorites/FavoriteToggleForm", () => ({
  default: ({
    listingId,
    isFavorited,
  }: {
    listingId: string
    isFavorited: boolean
  }) =>
    React.createElement(
      "form",
      { "data-testid": `favorite-form-${listingId}` },
      React.createElement(
        "button",
        {
          type: "submit",
          "aria-label": isFavorited ? "რჩეულებიდან ამოშლა" : "რჩეულებში დამატება",
          "aria-pressed": isFavorited,
        },
        "♥",
      ),
    ),
}))
