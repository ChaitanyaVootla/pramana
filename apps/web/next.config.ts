import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages are consumed as TypeScript source.
  transpilePackages: [
    "@pramana/core",
    "@pramana/db",
    "@pramana/services",
    "@pramana/connectors",
    "@pramana/mcp",
  ],
  serverExternalPackages: ["postgres"],
  // A second dev server (e.g. on the preview database) needs its own build dir.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  typedRoutes: false,
};

export default config;
