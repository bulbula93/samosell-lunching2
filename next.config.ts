import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lxsvjzbiuewgwpajqrwr.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
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
