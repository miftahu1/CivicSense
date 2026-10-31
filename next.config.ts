import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { remotePatterns: [] },
  turbopack: { root: process.cwd() },
};

export default nextConfig;
