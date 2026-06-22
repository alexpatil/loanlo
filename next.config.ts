import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer ships its own bundled deps and must not be processed by
  // the Next bundler — keep it external to the server build.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
