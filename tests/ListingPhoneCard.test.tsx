import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ProfilePhoneRequiredCard from "@/components/dashboard/ProfilePhoneRequiredCard"

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }))
vi.mock("@/app/dashboard/profile/phone-actions", () => ({ saveSellerPhoneAction: mocks.save }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))

beforeEach(() => { vi.resetAllMocks(); mocks.save.mockResolvedValue({ ok: true }) })

describe("inline listing phone", () => {
  it("explains visibility and focuses an invalid field without submitting", async () => {
    render(<ProfilePhoneRequiredCard />)
    expect(screen.getByText(/დაინტერესებულ მყიდველებს გამოუჩნდებათ/)).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "შეინახე და გააგრძელე" }))
    expect(screen.getByRole("alert")).toHaveTextContent("მოქმედი ტელეფონის ნომერი")
    expect(screen.getByLabelText("ტელეფონის ნომერი")).toHaveFocus()
    expect(screen.getByLabelText("ტელეფონის ნომერი")).toHaveAttribute("aria-invalid", "true")
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("waits for saving, prevents duplicate submissions, and opens the form in place", async () => {
    let finish!: (result: { ok: true }) => void
    mocks.save.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    render(<ProfilePhoneRequiredCard initialPhone="+995555123456" />)
    const form = screen.getByRole("form", { name: "განცხადებისთვის ტელეფონის დამატება" })
    fireEvent.submit(form); fireEvent.submit(form)
    expect(mocks.save).toHaveBeenCalledOnce()
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "ინახება…" })).toBeDisabled()
    finish({ ok: true })
    expect(await screen.findByRole("status")).toHaveTextContent("ნომერი შენახულია")
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(screen.getByRole("link", { name: "ფორმის გახსნა →" })).toHaveAttribute("href", "/dashboard/listings/new")
  })

  it("preserves the entered phone on a lost response and allows an idempotent retry", async () => {
    mocks.save.mockRejectedValueOnce(new Error("network"))
    render(<ProfilePhoneRequiredCard initialPhone="+995555123456" />)
    await userEvent.click(screen.getByRole("button", { name: "შეინახე და გააგრძელე" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("პასუხი ვერ მივიღეთ")
    expect(screen.getByLabelText("ტელეფონის ნომერი")).toHaveValue("+995555123456")
    expect(mocks.refresh).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "შეინახე და გააგრძელე" }))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
  })

  it("offers sign-in with the listing destination when the session expires", async () => {
    mocks.save.mockResolvedValue({ ok: false, code: "unauthorized", message: "თავიდან შედი" })
    render(<ProfilePhoneRequiredCard initialPhone="+995555123456" />)
    await userEvent.click(screen.getByRole("button", { name: "შეინახე და გააგრძელე" }))
    expect(await screen.findByRole("link", { name: "ანგარიშში შესვლა" })).toHaveAttribute("href", "/login?next=%2Fdashboard%2Flistings%2Fnew")
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
