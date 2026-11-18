/**
 * Regression check for the maps: loads pages in a real browser and asserts
 * that each atlas finished loading and draws borders and places, so a map
 * that silently renders nothing (a veil, no features) fails loudly.
 *
 *   pnpm tsx scripts/check-atlas.ts [/p/maurya-empire /places …]
 *
 * Env: CHECK_FIRST_MS (first-paint limit, default 5000; over CHECK_SLOW_MS, default 3000, is reported as slow), PRAMANA_WEB_URL (default http://127.0.0.1:3200, the preview test
 * server), SHOT_THEME=dark, SHOT_WIDTH. Needs a development build: MapCanvas
 * exposes its map on the container (`__map`) only outside production.
 * Exits non-zero on any failure.
 */
import { chromium } from "playwright";

const base = process.env.PRAMANA_WEB_URL ?? "http://127.0.0.1:3200";
const paths = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["/p/maurya-empire", "/p/independence-movement", "/p/gupta-empire", "/places"];
const theme = process.env.SHOT_THEME as "light" | "dark" | undefined;

interface MapReport {
  loaded: boolean;
  veil: boolean;
  borders: number;
  /** The atlas says there are no borders for its year (expected for some ages). */
  noBorders: boolean;
  places: number;
  year: string | null;
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(process.env.SHOT_WIDTH ?? 1440), height: 1000 },
  ...(theme ? { colorScheme: theme } : {}),
});
if (theme) await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

/**
 * How soon after load the atlas must draw its borders and places. A dev
 * server compiles on demand (and recompiles while files change), so the hard
 * limit is generous and anything over SLOW_MS is reported as slow.
 */
const FIRST_MS = Number(process.env.CHECK_FIRST_MS ?? 5000);
const SLOW_MS = Number(process.env.CHECK_SLOW_MS ?? 3000);

let failed = 0;
/** The few MapLibre methods the check calls (scripts do not depend on maplibre-gl). */
type MapLike = {
  isStyleLoaded(): boolean;
  getLayer(id: string): unknown;
  queryRenderedFeatures(opts: { layers: string[] }): unknown[];
};

for (const path of paths) {
  errors.length = 0;
  await page.goto(`${base}${path}`, { waitUntil: "load", timeout: 60_000 });
  // First paint: how long after the page's load event the visible atlas draws
  // both borders and places (a map that paints bare terrain first fails here).
  const t0 = Date.now();
  const firstMs = await page
    .waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll<HTMLElement & { __map?: MapLike }>(
            "[data-atlas] .maplibregl-map",
          ),
        )
          .filter((el) => el.offsetParent !== null)
          .some((el) => {
            const map = el.__map;
            if (!map?.getLayer("extents-fill")) return false;
            return (
              (map.queryRenderedFeatures({
                layers: ["extents-fill", "extents-culture"].filter((id) => map.getLayer(id)),
              }).length > 0 ||
                // A time with no borders at all says so (the Vedic age): that is its first paint.
                /No borders/.test(el.closest("[data-atlas]")?.textContent ?? "")) &&
              map.queryRenderedFeatures({
                layers: ["points", "context-points"].filter((id) => map.getLayer(id)),
              }).length > 0
            );
          }),
      undefined,
      { timeout: 20_000, polling: 100 },
    )
    .then(() => Date.now() - t0)
    .catch(() => null);
  // Every atlas the reader can see (a page may also hold hidden ones, e.g. the
  // phone layout's): wait until each has its layers and no veil (or give up).
  await page
    .locator("[data-atlas] .maplibregl-map")
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await page
    .waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll<HTMLElement & { __map?: MapLike }>(
            "[data-atlas] .maplibregl-map",
          ),
        )
          .filter((el) => el.offsetParent !== null)
          .every(
            (el) =>
              Boolean(el.__map?.getLayer("extents-fill")) &&
              !el.parentElement?.querySelector(".animate-pulse"),
          ),
      undefined,
      { timeout: 30_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(2500); // data, fades and tiles
  // No named helpers in here: tsx would wrap them in __name, which the page does not have.
  const read = () =>
    page
      .evaluate((): MapReport[] =>
        Array.from(
          document.querySelectorAll<HTMLElement & { __map?: MapLike }>(
            "[data-atlas] .maplibregl-map",
          ),
        )
          .filter((el) => el.offsetParent !== null)
          .map((el) => {
            const map = el.__map;
            return {
              loaded: Boolean(map?.getLayer("extents-fill")),
              veil: Boolean(el.parentElement?.querySelector(".animate-pulse")),
              noBorders: /No borders/.test(el.closest("[data-atlas]")?.textContent ?? ""),
              borders: map
                ? map.queryRenderedFeatures({
                    layers: ["extents-fill", "extents-culture"].filter((id) => map.getLayer(id)),
                  }).length
                : 0,
              places: map
                ? map.queryRenderedFeatures({
                    layers: ["points", "context-points"].filter((id) => map.getLayer(id)),
                  }).length
                : 0,
              year: el.closest("[data-atlas]")?.querySelector(".font-serif")?.textContent ?? null,
            };
          }),
      )
      .catch((e: Error) => {
        errors.push(`could not read the maps: ${e.message.split("\n")[0]}`);
        return [] as MapReport[];
      });
  let reports = await read();
  // One more look before failing: another agent's edit may have hot-reloaded the page mid-check.
  if (reports.some((r) => (!r.borders && !r.noBorders) || !r.places)) {
    await page.waitForTimeout(4000);
    reports = await read();
  }
  if (!reports.length)
    reports.push({
      loaded: false,
      veil: true,
      borders: 0,
      noBorders: false,
      places: 0,
      year: null,
    });
  reports.forEach((r, n) => {
    const problems = [
      !r.loaded && "map never loaded",
      r.veil && "loading veil still shown",
      r.borders === 0 && !r.noBorders && "no borders drawn",
      r.places === 0 && "no places drawn",
      ...(n === 0 ? errors.map((e) => `error: ${e.slice(0, 200)}`) : []),
      n === 0 &&
        (firstMs === null || firstMs > FIRST_MS) &&
        `borders and places not drawn within ${FIRST_MS} ms of load (${firstMs ?? "never"})`,
    ].filter(Boolean);
    const which = `${reports.length > 1 ? ` (atlas ${n + 1} of ${reports.length})` : ""}${n === 0 && firstMs !== null ? `, first paint ${firstMs} ms${firstMs > SLOW_MS ? " (slow)" : ""}` : ""}`;
    console.log(
      `${problems.length ? "FAIL" : "ok  "} ${path}${which}  year ${r.year ?? "?"}, ${r.borders} border and ${r.places} place features${problems.length ? `: ${problems.join("; ")}` : ""}`,
    );
    if (problems.length) failed++;
  });
}
await browser.close();
process.exit(failed ? 1 : 0);
