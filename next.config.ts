import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Dev-only: Next blocks `/_next/*` and HMR when the browser Origin host is not allowlisted.
   * Opening http://127.0.0.1:3000 (or IPv6 localhost) otherwise fails with connection errors
   * because only "localhost" is allowed by default.
   */
  allowedDevOrigins: ["127.0.0.1", "::1"],
};

export default nextConfig;
