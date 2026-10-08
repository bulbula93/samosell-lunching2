import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import BrandCombobox from "@/components/dashboard/BrandCombobox"
function Form() {
  const [brand, setBrand] = useState({ brandId: "zara-id", customBrand: "" })
  return <><BrandCombobox id="brand" brands={[{ id: "zara-id", name: "Zara" }]} {...brand} onChange={setBrand} /><output>{JSON.stringify(brand)}</output></>
}
describe("optional Other brand choice", () => {
  it("offers Other and switches from an existing brand, back to known brand or blank", () => {
    render(<Form />)
    const input = screen.getByRole("combobox", { name: /ბრენდი/ })
    expect(input).toHaveValue("Zara")
    expect(document.querySelector('option[value="სხვა"]')).not.toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /^სხვა$/ }))
    expect(input).toHaveValue("სხვა")
    expect(screen.getByRole("status")).toHaveTextContent('"brandId":"","customBrand":"სხვა"')
    fireEvent.change(input, { target: { value: "Zara" } })
    expect(screen.getByRole("status")).toHaveTextContent('"brandId":"zara-id","customBrand":""')
    fireEvent.change(input, { target: { value: "" } })
    expect(screen.getByRole("status")).toHaveTextContent('"brandId":"","customBrand":""')
  })
})
