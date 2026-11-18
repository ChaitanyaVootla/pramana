/**
 * Browser check of a canvas against a test server (never :3000): it renders at
 * 1440, 1920 and 390 px in light and dark, drags a tile and confirms the move
 * was saved, nudges one with the keyboard, and on a phone shows the list.
 *
 *   PRAMANA_WEB_URL=http://127.0.0.1:3200 DATABASE_URL=…/pramana_preview PRAMANA_USER_HANDLE=test-learner \
 *     pnpm tsx scripts/check-canvas.ts <canvasId> [outDir]
 *
 * Build the demo canvas first: pnpm tsx scripts/demo/asoka-canvas.ts
 */
import { chromium, type Page } from "playwright";
import { connectMcp } from "./lib/mcp-client";

const [id, outDir = "."] = process.argv.slice(2);
const base = process.env.PRAMANA_WEB_URL ?? "";
if (!id || !base || /:3000\b/.test(base)) {
  console.error("usage: PRAMANA_WEB_URL=http://127.0.0.1:3200 tsx scripts/check-canvas.ts <canvasId> [outDir] (never :3000)");
  process.exit(1);
}

interface Layout { x: number; y: number; w: number; h: number }
const layouts = async (page: Page) => {
  const res = await page.request.get(`${base}/api/canvas/${id}`);
  const c = (await res.json()) as { items: { id: string; kind: string; layout: Layout }[] };
  return new Map(c.items.map((i) => [i.id, i]));
};

const browser = await chromium.launch();
let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures++;
};

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 1920, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 1000 }, colorScheme: theme });
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/canvas/${id}`, { waitUntil: "load" });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${outDir}/canvas-${width}-${theme}.png` });
    check(errors.length === 0, `${width} ${theme}: no page errors${errors.length ? ` (${errors[0]})` : ""}`);
    if (width < 600) {
      check((await page.locator("ol[aria-label^='Items on'] > li").count()) > 3, `${width}: phone shows the list`);
    } else {
      check((await page.locator(".react-flow__node").count()) > 3, `${width}: board shows tiles`);
      // Scroll the board down (trackpad-style pan) for a second picture.
      await page.mouse.move(width / 2, 600);
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${outDir}/canvas-${width}-${theme}-lower.png` });
    }
    await page.close();
  }
}

// Drag a tile by its header and confirm the server stored the new place.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/canvas/${id}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const before = await layouts(page);
  const node = page.locator(".react-flow__node").filter({ has: page.locator("article") }).nth(1);
  const nodeId = (await node.getAttribute("data-id"))!;
  const handle = node.locator("header.tile-handle");
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 40 + 220, box.y + box.height / 2 + 300, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  const after = await layouts(page);
  const a = before.get(nodeId)!.layout;
  const b = after.get(nodeId)!.layout;
  check(a.x !== b.x || a.y !== b.y, `drag saved: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  // Keyboard: focus the tile, move it one column left, and wait for the save.
  await node.locator("article").focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(1400);
  const moved = (await layouts(page)).get(nodeId)!.layout;
  check(moved.x === Math.max(0, b.x - 1), `keyboard nudge saved: x ${b.x} -> ${moved.x}`);
  // Put every tile back where it was, through MCP as the same test learner (needs DATABASE_URL and
  // PRAMANA_USER_HANDLE of the test server; skipped without them).
  if (process.env.DATABASE_URL && process.env.PRAMANA_USER_HANDLE) {
    const mcp = await connectMcp("check-canvas");
    await mcp.call("canvas_arrange", { canvas: id, layouts: [...before.values()].map((i) => ({ id: i.id, layout: i.layout })) });
    await mcp.close();
    console.log("     layout restored");
  }
  await page.close();
}

await browser.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
