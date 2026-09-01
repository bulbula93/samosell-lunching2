import type { Metadata, Viewport } from "next"
import { Suspense } from "react"
import SiteFooter from "@/components/layout/SiteFooter"
import PwaRuntime from "@/components/pwa/PwaRuntime"
import ClientInstrumentation from "@/components/shared/ClientInstrumentation"
import { absoluteUrl, getSiteUrl, GOOGLE_SITE_VERIFICATION } from "@/lib/seo"
import { SITE_DESCRIPTION_EN, SITE_DESCRIPTION_KA, SITE_NAME } from "@/lib/site"
import "./globals.css"

export const viewport: Viewport = {
  themeColor: "#075A53",
  colorScheme: "light",
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION_KA,
  applicationName: SITE_NAME,
  verification: {
    google: GOOGLE_SITE_VERIFICATION,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION_EN,
    url: getSiteUrl(),
    images: [{ url: absoluteUrl("/og-cover.png") }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION_EN,
    images: [absoluteUrl("/og-cover.png")],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ka" className="h-full antialiased">
      <body className="min-h-full bg-bg text-text">
        <a
          href="#main-content"
          className="fixed left-4 top-3 z-[120] -translate-y-20 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-lg transition focus:translate-y-0"
        >
          მთავარ კონტენტზე გადასვლა
        </a>
        <PwaRuntime />
        <Suspense fallback={null}>
          <ClientInstrumentation />
        </Suspense>
        <div className="flex min-h-screen flex-col">
          <div id="main-content" className="flex-1" tabIndex={-1}>{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  )
}
