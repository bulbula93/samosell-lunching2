import type { MetadataRoute } from "next"
import { SITE_DESCRIPTION_KA, SITE_NAME } from "@/lib/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
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
        src: "/icon.svg",
        sizes: "any",
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
