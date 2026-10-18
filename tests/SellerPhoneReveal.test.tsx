import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SellerPhoneReveal from "@/components/sellers/SellerPhoneReveal"

afterEach(() => vi.unstubAllGlobals())

describe("seller profile phone reveal", () => {
  it("requests the seller phone only on click and then offers a normalized call link", async () => {
    const fetchPhone = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ phone: "+995 555 12 34 56" }) })
    vi.stubGlobal("fetch", fetchPhone)
    render(<SellerPhoneReveal sellerUsername="Lana sar" sellerLabel="ლანა" />)

    expect(screen.getByText("ნომრის ნახვა")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(fetchPhone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "ლანა-ს ტელეფონის ნომრის ნახვა" }))

    expect(await screen.findByRole("link", { name: "ლანა-სთან დარეკვა: +995 555 12 34 56" })).toHaveAttribute("href", "tel:+995555123456")
    expect(fetchPhone).toHaveBeenCalledOnce()
    expect(fetchPhone).toHaveBeenCalledWith("/api/seller-phone", expect.objectContaining({
      method: "POST", cache: "no-store", body: JSON.stringify({ sellerUsername: "Lana sar" }),
    }))
  })

  it("keeps the number hidden on failure and permits a retry", async () => {
    const fetchPhone = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ phone: "555123456" }) })
    vi.stubGlobal("fetch", fetchPhone)
    render(<SellerPhoneReveal sellerUsername="seller" sellerLabel="გამყიდველი" />)

    fireEvent.click(screen.getByRole("button"))
    expect(await screen.findByRole("alert")).toHaveTextContent("ნომრის ჩვენება ვერ მოხერხდა")
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button")).toBeEnabled())
    fireEvent.click(screen.getByRole("button"))
    expect(await screen.findByRole("link")).toHaveAttribute("href", "tel:555123456")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
