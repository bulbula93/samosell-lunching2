import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import MetaSpendSyncButton from "@/components/growth/MetaSpendSyncButton"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
afterEach(() => vi.unstubAllGlobals())

describe("Meta spend sync feedback", () => {
  it("explains expired tokens without displaying provider payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: "meta_authorization_failed", reason: "meta_token_expired" }) }))
    render(<MetaSpendSyncButton configurationIssue={null} />)
    fireEvent.click(screen.getByRole("button", { name: "Sync Meta spend" }))
    expect(await screen.findByText(/Meta token-ის ვადა ამოიწურა/)).toBeVisible()
  })

  it("falls back to a safe error message for an unknown provider reason", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: "meta_authorization_failed", reason: "private-provider-payload" }) }))
    render(<MetaSpendSyncButton configurationIssue={null} />)
    fireEvent.click(screen.getByRole("button", { name: "Sync Meta spend" }))
    expect(await screen.findByText(/Meta API-ის წვდომა უარყოფილია/)).toBeVisible()
    expect(screen.queryByText(/private-provider-payload/)).not.toBeInTheDocument()
  })
})
