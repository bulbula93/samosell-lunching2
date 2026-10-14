import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import OpenGraphImage, { size } from "@/app/opengraph-image"

describe("default Open Graph image", () => {
  it("serves the existing complete PNG with the advertised dimensions", async () => {
    const response = await OpenGraphImage()
    const bytes = new Uint8Array(await response.arrayBuffer())
    const header = new DataView(bytes.buffer)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(header.getUint32(16)).toBe(size.width)
    expect(header.getUint32(20)).toBe(size.height)
    // Preserve the pre-optimization output exactly, including all artwork/text.
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("d85769a696e47f11ea3da47afa5ada8e543379d327235279da3d05e2d084bf57")
  })
})
