import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loads the repository's root `.env` once (Node's built-in loader), so every
 * entry point (web, MCP, scripts) sees the same configuration. Variables that
 * are already set win.
 */
let loaded = false;
export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;
  // Look upward from the working directory, then from this file (so an MCP
  // client may start the server from any directory).
  const starts = [process.cwd()];
  try {
    starts.push(dirname(fileURLToPath(import.meta.url)));
  } catch {
    // bundled without a file URL
  }
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 8; i++) {
      if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
        process.env.PRAMANA_ROOT ??= dir;
        const candidate = join(dir, ".env");
        if (existsSync(candidate)) process.loadEnvFile(candidate);
        return;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
}

export function repoRoot(): string {
  loadRootEnv();
  return process.env.PRAMANA_ROOT ?? resolve(/* turbopackIgnore: true */ process.cwd());
}

export function requireEnv(name: string, fallback?: string): string {
  loadRootEnv();
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}
