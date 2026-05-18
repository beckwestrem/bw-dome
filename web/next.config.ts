import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Dev HMR: allow both hostnames so webpack-hmr isn’t blocked when mixing localhost ↔ 127.0.0.1 */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: process.cwd(),
  },
  /**
   * Next.js 16 proxy clones request bodies; default ~10MB can truncate large CSV uploads.
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize
   */
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
