import artwork from "@/lib/opengraph-default-png.json"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// The default artwork is invariant. Keep its existing PNG bytes and metadata
// URL without packaging the image renderer and native codecs in API functions.
// Regenerate this asset when intentionally changing the default OG artwork.
export default function OpenGraphImage() {
  // Bundle the small PNG payload directly; runtime file tracing is unnecessary.
  return new Response(new Uint8Array(Buffer.from(artwork.base64, "base64")), {
    headers: { "Content-Type": contentType },
  })
}
