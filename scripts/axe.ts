/**
 * Dev helper: run axe-core on pages of the running web app, at a width and theme.
 *   PRAMANA_WEB_URL=http://127.0.0.1:3200 SHOT_WIDTH=1440 SHOT_THEME=dark pnpm tsx scripts/axe.ts / /p/maurya-empire
 * "/path!selector" clicks the selector first (to check a popover or dialog open), as pnpm screenshot does.
 * Prints every violation with the rule, impact and the first few offending nodes;
 * exits 1 when any serious or critical violation is found. Never run it on :3000.
 */
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("usage: tsx scripts/axe.ts /path [/path...]");
  process.exit(1);
}
const base = process.env.PRAMANA_WEB_URL ?? "http://127.0.0.1:3200";
if (/:3000\b/.test(base)) {
  console.error("refusing to automate the live server on :3000; use a test server");
  process.exit(2);
}
const width = Number(process.env.SHOT_WIDTH ?? 1440);
const theme = process.env.SHOT_THEME as "light" | "dark" | undefined;
const browser = await chromium.launch();
// axe needs a context it can open a second page in.
const context = await browser.newContext({ viewport: { width, height: 1000 }, ...(theme ? { colorScheme: theme } : {}) });
if (theme) await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
const page = await context.newPage();

let bad = 0;
for (const arg of paths) {
  const [path, click] = arg.split("!") as [string, string | undefined];
  await page.goto(`${base}${path}`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(Number(process.env.SHOT_WAIT ?? 1500));
  if (click) {
    await page.click(click);
    await page.waitForTimeout(600);
  }
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "best-practice"])
    // MapLibre's canvas and the Vega charts are checked by hand.
    .exclude(".maplibregl-canvas")
    .exclude(".vega-embed")
    .analyze();
  const label = `${arg} @${width}${theme ? ` ${theme}` : ""}`;
  if (results.violations.length === 0) {
    console.log(`ok   ${label}`);
    continue;
  }
  console.log(`FAIL ${label}: ${results.violations.length} rule(s)`);
  for (const v of results.violations) {
    if (v.impact === "serious" || v.impact === "critical") bad++;
    console.log(`  ${v.impact ?? "?"}  ${v.id}: ${v.help} (${v.nodes.length})`);
    for (const n of v.nodes.slice(0, 4)) {
      console.log(`      ${n.target.join(" ")}`);
      const why = n.any[0]?.message ?? n.all[0]?.message;
      if (why) console.log(`        ${why.slice(0, 200)}`);
    }
  }
}
await browser.close();
process.exit(bad ? 1 : 0);
