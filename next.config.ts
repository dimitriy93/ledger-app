import type { NextConfig } from "next";

// GitHub Pages serves the app from /<repo-name>, so the basePath is injected
// at build time by CI (NEXT_PUBLIC_BASE_PATH). Empty when building locally.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
