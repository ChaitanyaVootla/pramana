// MapLibre runs tile decoding in a web worker. Bundlers cannot always resolve
// the worker URL the library computes, so we serve the worker file ourselves
// from /public and point MapLibre at it (see components/MapView.tsx).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync(join(here, "..", "public"), { recursive: true });
copyFileSync(
  join(pkg, "dist", "maplibre-gl-worker.mjs"),
  join(here, "..", "public", "maplibre-gl-worker.mjs"),
);
