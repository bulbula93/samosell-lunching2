import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import AdminAgentClient from "@/components/admin/AdminAgentClient"
const props = { initialSummary: "Local snapshot", aiConfigured: true, generatedAt: "2026-10-18T00:00:00Z", providerName: "Muse Spark Open" }
afterEach(() => vi.unstubAllGlobals())
describe("Admin Copilot provider connection UI", () => {
  it("never claims a connection based on configuration alone", () => {
    render(<AdminAgentClient {...props} />)
    expect(screen.getByText("API NOT VERIFIED")).toBeInTheDocument()
    expect(screen.queryByText("AI CONNECTED")).not.toBeInTheDocument()
    expect(screen.getByText("Built with Muse Spark Open")).toBeInTheDocument()
  })
  it.each([["ai", "muse-spark", null, "AI CONNECTED"], ["fallback", "deterministic", "timeout", "DETERMINISTIC FALLBACK"]])("renders %s truthfully after a response", async (mode, provider, failure, label) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: "Synthetic answer", mode, provider, failure }) }))
    render(<AdminAgentClient {...props} />)
    fireEvent.change(screen.getByLabelText("დავალება აგენტისთვის"), { target: { value: "Synthetic backlog?" } })
    fireEvent.click(screen.getByRole("button", { name: "გაგზავნა" }))
    await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument())
    expect(screen.getByText("Synthetic answer")).toBeInTheDocument()
    if (failure === "timeout") expect(screen.getByRole("status")).toHaveTextContent("დრო ამოიწურა")
  })
  it("does not claim a deterministic response after a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")))
    render(<AdminAgentClient {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "დღეს რა არის ყველაზე პრიორიტეტული?" }))
    await waitFor(() => expect(screen.getByText("REQUEST FAILED")).toBeInTheDocument())
    expect(screen.queryByText("DETERMINISTIC FALLBACK")).not.toBeInTheDocument()
  })
})
