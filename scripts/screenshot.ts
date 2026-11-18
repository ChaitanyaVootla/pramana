/**
 * Dev helper: screenshot pages of the running web app for visual review.
 *   pnpm tsx scripts/screenshot.ts <outDir> /path [/path...]
 * "/path!selector" clicks an element first; "/path@selector" scrolls it into view.
 * Env: PRAMANA_WEB_URL, SHOT_WIDTH, SHOT_THEME=dark|light, SHOT_FULL=0 (viewport only),
 * SHOT_WAIT (ms after load), SHOT_PREFIX (file name prefix), SHOT_AFTER (ms after a "@" scroll
 * or "!" click, default 1500).
 * A scroll or click waits for the page to hydrate first (React attached to the body; never
 * network idle, the SSE stream stays open), so scroll observers and handlers are live.
 * Also prints browser console errors, which surface client-side failures.
 *
 * A dev server may reload the page under us (a hot-reload full refresh): the capture
 * is retried on the same page, and a path that still fails is opened again, up to
 * three times, so one reload does not end the batch.
 */
import { chromium } from "playwright";

const [outDir, ...paths] = process.argv.slice(2);
if (!outDir || paths.length === 0) {
  console.error("usage: tsx scripts/screenshot.ts <outDir> /path [/path...]");
  process.exit(1);
}
const base = process.env.PRAMANA_WEB_URL ?? "http://127.0.0.1:3000";
const width = Number(process.env.SHOT_WIDTH ?? 1440);
// SHOT_THEME=dark|light: sets the device colour scheme and the stored theme before the app loads.
const theme = process.env.SHOT_THEME as "light" | "dark" | undefined;
const full = process.env.SHOT_FULL !== "0";
const prefix = process.env.SHOT_PREFIX ?? "";
const browser = await chromium.launch();

const RELOADED = /destroyed|navigation|detached|closed/i;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Until React has hydrated the page (its fiber is on the body), or 20 s. */
async function hydrated(page: import("playwright").Page) {
  await page
    .waitForFunction(() => Object.keys(document.body).some((k) => k.startsWith("__reactFiber")), null, {
      timeout: 20_000,
    })
    .catch(() => console.log("page did not hydrate within 20 s; going on"));
}

async function shoot(path: string, attempt: number): Promise<boolean> {
  const page = await browser.newPage({
    viewport: { width, height: 1000 },
    deviceScaleFactor: 1,
    ...(theme ? { colorScheme: theme } : {}),
  });
  if (theme) await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  page.on(
    "console",
    (m) => m.type() === "error" && console.log(`[console] ${m.text().slice(0, 300)}`),
  );
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message.slice(0, 300)}`));
  try {
    const [, route = "/", sep, target] = /^([^!@]*)([!@]?)(.*)$/.exec(path) ?? [];
    await page.goto(`${base}${route}`, { waitUntil: "load", timeout: 60_000 });
    if (sep) await hydrated(page);
    if (sep === "@") {
      // To the top of the view, where the page's own "you are here" line reads it.
      await page.locator(target!).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(Number(process.env.SHOT_AFTER ?? 1500));
    } else if (sep === "!") {
      await page
        .click(target!, { timeout: 10_000 })
        .catch((e) => console.log(`click failed: ${(e as Error).message.split("\n")[0]}`));
      await page.waitForTimeout(Number(process.env.SHOT_AFTER ?? 1500));
    }
    await page.waitForTimeout(Number(process.env.SHOT_WAIT ?? 1200));
    const file = `${outDir}/${prefix}${(route.replace(/[^a-z0-9]+/gi, "_") || "home") + (sep ? "_click" : "") + (theme ? `_${theme}` : "")}.png`;
    for (let i = 0; ; i++) {
      try {
        await page.waitForLoadState("load");
        // A full-page capture grows the viewport for an instant; maps (WebGL) are cleared on
        // resize and would show a blank band. Grow it first and give them time to redraw.
        if (full) {
          const h = await page.evaluate(() => document.documentElement.scrollHeight);
          await page.setViewportSize({ width, height: Math.min(h, 16000) });
          await page.waitForTimeout(1500);
        }
        await page.screenshot({ path: file, fullPage: full, timeout: 60_000 });
        break;
      } catch (e) {
        if (i >= 4 || !RELOADED.test((e as Error).message)) throw e;
        console.log(`reloaded under us on ${path}; waiting`);
        await page.waitForTimeout(4000);
      }
    }
    console.log("saved", file);
    return true;
  } catch (e) {
    const msg = (e as Error).message.split("\n")[0];
    if (attempt < 3) {
      console.log(`retry ${attempt + 1} for ${path}: ${msg}`);
      await page.close().catch(() => {});
      await pause(3000);
      return shoot(path, attempt + 1);
    }
    console.log(`FAILED ${path}: ${msg}`);
    return false;
  } finally {
    await page.close().catch(() => {});
  }
}

let failed = 0;
for (const path of paths) if (!(await shoot(path, 0))) failed++;
await browser.close();
if (failed) process.exitCode = 1;
