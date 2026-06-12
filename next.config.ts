import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone with a minimal server.js + traced node_modules for slim Docker images.
  output: "standalone",
  // sharp ships a native binary that file tracing can miss; force it into the standalone bundle.
  outputFileTracingIncludes: {
    "/**": ["node_modules/sharp/**/*"],
  },
};

export default nextConfig;
