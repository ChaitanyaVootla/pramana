/**
 * Checks offline study in a browser (Playwright), against a server running as
 * a TEST learner (for example the preview server with
 * PRAMANA_USER_HANDLE=test-learner): it answers review cards.
 *
 *   pnpm tsx scripts/learn-offline-check.ts http://127.0.0.1:3200
 *
 * 1. Opens /learn online and waits for the service worker to take control.
 * 2. Goes offline without reloading, answers two cards, and checks they wait
 *    in the device's queue with the offline notice shown.
 * 3. Comes back online and checks both were sent, then replays one key and
 *    checks the server reports it as a duplicate.
 * 4. Reloads /learn offline and checks the page comes from the cache and runs.
 *    Under `next dev` this step is expected to fail (the dev client waits for
 *    its hot-reload connection); run it against a production build.
 * 5. Answers a card from the device's copy, offline, and checks it is sent
 *    once the connection returns.
 */
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:3200";
let failures = 0;
const expect = (what: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok || detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
};
const queue = () =>
  new Promise<{ key: string; sent: boolean }[]>((res) => {
    const r = indexedDB.open("pramana-study", 1);
    r.onsuccess = () => {
      const g = r.result.transaction("queue").objectStore("queue").getAll();
      g.onsuccess = () => res(g.result);
    };
  });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
try {
  await page.goto(`${base}/learn`, { waitUntil: "load", timeout: 90_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(4000);
  expect("the service worker controls /learn", await page.evaluate(() => Boolean(navigator.serviceWorker.controller)));
  const card = page.getByRole("region", { name: "Study card" });
  if (!(await card.count())) throw new Error("no cards due for this learner; add some to their reviews first");

  await context.setOffline(true);
  const before = (await page.evaluate(queue)).length;
  for (const sure of ["Fairly sure", "Just a guess"]) {
    await card.getByRole("radio", { name: sure }).click();
    await card.getByRole("button", { name: "I was right" }).click();
    await page.waitForTimeout(1200);
  }
  const offlineQueue = (await page.evaluate(queue)).filter((q) => !q.sent);
  expect("answers wait on the device while offline", offlineQueue.length >= 2, offlineQueue.length);
  expect("the offline notice is shown", (await card.getByRole("status").allInnerTexts()).join(" ").includes("Offline"));

  await context.setOffline(false);
  await page.waitForTimeout(4000);
  const after = await page.evaluate(queue);
  expect("they are sent when back online", after.filter((q) => !q.sent).length === 0 && after.length >= before + 2);
  const replay = await page.evaluate(async (item) => {
    const { sent: _sent, ...body } = item as Record<string, unknown>;
    const r = await fetch("/api/study/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviews: [body] }) });
    return (await r.json()) as { results: { status: string }[] };
  }, after.at(-1)!);
  expect("a replayed answer is recorded once", replay.results[0]?.status === "duplicate", replay);

  await context.setOffline(true);
  await page.reload({ waitUntil: "load" }).catch(() => undefined);
  await page.waitForTimeout(8000);
  const hydrated = await page.evaluate(() => Object.keys(document.querySelector('[aria-label="Study card"]') ?? {}).some((k) => k.startsWith("__react")));
  expect("/learn reloads offline and runs (production builds only)", hydrated);
  if (hydrated) {
    // 5. Study from the device's copy after an offline reload, then sync.
    const queued = (await page.evaluate(queue)).length;
    const offlineCard = page.getByRole("region", { name: "Study card" });
    await offlineCard.getByRole("radio", { name: "Sure", exact: true }).click();
    await offlineCard.getByRole("button", { name: "I was wrong" }).click();
    await page.waitForTimeout(1500);
    expect("an answer given after an offline reload is queued", (await page.evaluate(queue)).length === queued + 1);
    await context.setOffline(false);
    await page.waitForTimeout(5000);
    expect("and sent when back online", (await page.evaluate(queue)).every((q) => q.sent));
  }
} finally {
  await browser.close();
}
if (failures) process.exit(1);
