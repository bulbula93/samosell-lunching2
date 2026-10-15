import { describe, expect, it } from "vitest"
import { getStoreContactLinks } from "@/components/stores/StoreContactStrip"

describe("Storefront social links", () => {
  it("shows no invented social profiles when fields are blank", () => {
    expect(getStoreContactLinks({})).toEqual([])
  })

  it("creates proper links for the shop's saved networks", () => {
    const links = getStoreContactLinks({
      instagram: "@samo.sell",
      facebook: "facebook.com/samosell",
      tiktok: "@samo.sell",
      whatsapp: "+995 555 12 34 56",
      telegram: "@samosell",
      website: "samosell.ge",
    })
    expect(links.map((x) => x.key)).toEqual(["instagram","facebook","tiktok","whatsapp","telegram","website"])
    expect(links.find(x => x.key === "instagram")?.href).toBe("https://instagram.com/samo.sell")
    expect(links.find(x => x.key === "whatsapp")?.href).toBe("https://wa.me/995555123456")
    expect(links.find(x => x.key === "website")?.href).toBe("https://samosell.ge")
  })

  it("does not create a link from an invalid web address", () => {
    const links = getStoreContactLinks({ website: "http://", facebook: "https://", tiktok: "broken handle!" })
    expect(links).toHaveLength(0)
  })

  it("rejects third-party URLs disguised as WhatsApp", () => {
    expect(getStoreContactLinks({whatsapp:"https://not-whatsapp.example/collect"})).toEqual([])
  })
})
