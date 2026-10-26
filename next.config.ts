import { SECURITY_HEADERS } from "./lib/security-headers";
import type { NextConfig } from "next";
import { PRODUCTION_PUBLIC_FALLBACK } from "./lib/env";
import { getPublicStorageHosts } from "./lib/media";

const isReadOnlyReviewPreview =
  process.env.VERCEL_ENV === "preview" &&
  [
    "preview/public-cache-personalization-20261019",
    "preview/vercel-storage-optimization-20261014",
    "preview/listing-upload-idempotency-20261016",
    "preview/store-cards-copy-20261016",
  ].includes(process.env.VERCEL_GIT_COMMIT_REF ?? "");

const nextConfig: NextConfig = {
  // These exact review branches read public production data and block writes.
  // No persisted Vercel environment variables are changed.
  ...(isReadOnlyReviewPreview ? {
    env: {
      NEXT_PUBLIC_PREVIEW_READ_ONLY: "true",
      NEXT_PUBLIC_SUPABASE_URL: PRODUCTION_PUBLIC_FALLBACK.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PRODUCTION_PUBLIC_FALLBACK.supabasePublishableKey,
      NEXT_PUBLIC_SITE_URL: PRODUCTION_PUBLIC_FALLBACK.siteUrl,
    },
  } : {}),
  // Do not advertise the framework in every response.
  poweredByHeader: false,
  // CSP starts in report-only mode to preserve hydration and existing workflows.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: getPublicStorageHosts().map((hostname) => (
      {
        protocol: "https" as const,
        hostname,
        pathname: "/storage/v1/object/public/**",
      }
    )),
    // Keep one optimized output format. Supporting AVIF and WebP creates
    // separate cached transformations for the same source/size combination.
    formats: ["image/webp"],
    // Listing/ad image object paths are UUID-based and effectively immutable,
    // so transformed variants can safely stay cached for 31 days.
    minimumCacheTTL: 2_678_400,
    // The app currently uses the default Next/Image quality (75). Restricting
    // the allowlist prevents accidental extra transformation variants.
    qualities: [75],
    // Match the widths SamoSell actually needs instead of the much wider
    // default matrix (including 3840px). Fewer allowed widths means fewer
    // unique transformations while still covering cards and detail galleries.
    deviceSizes: [640, 768, 1024, 1280, 1600, 1920, 2048],
    imageSizes: [24, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
