import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/signa-play",
  assetPrefix: "/signa-play/",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
