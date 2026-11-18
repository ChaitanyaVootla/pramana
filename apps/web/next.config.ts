import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const standalone = process.env.NEXT_OUTPUT === "standalone";

const config: NextConfig = {
  // Self-contained server bundle for the Docker image (deploy/Dockerfile).
  ...(standalone
    ? { output: "standalone" as const, outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)) }
    : {}),
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
