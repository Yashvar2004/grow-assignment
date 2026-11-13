import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mammoth", "pdfjs-dist"],
  turbopack: { root: process.cwd() },
};

export default nextConfig;
