import type { MetadataRoute } from "next"
import { SITE_DESCRIPTION_KA, SITE_NAME } from "@/lib/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION_KA,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7F1E8",
    theme_color: "#075A53",
    lang: "ka",
    categories: ["shopping", "social"],
    icons: [
      {
        src: "/pwa-icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
