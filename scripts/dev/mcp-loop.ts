/**
 * End-to-end loop over MCP's HTTP endpoint, against a test server only:
 *   pnpm tsx scripts/dev/mcp-loop.ts [--keep] [--out <dir>]
 *
 * 1. Checks the guards: no token → 401, a foreign Origin or Host → 403.
 * 2. Connects with the local token (the SDK's Streamable HTTP client), as an AI client would.
 * 3. Checks that a posted note reaches the live event stream (/api/events).
 * 3b. With a browser already open on each page, posts a note with a Vega-Lite chart about an
 *    entity and one about a chapter, and waits for each to arrive live (no reload).
 * 4. Checks the presence sentence on /connect, proposes a small changeset in preview,
 *    sees it under Review, and withdraws it.
 * 5. Archives its notes at the end (unless --keep), and earlier runs' notes at the start, so it
 *    can run again and again.
 *
 * Runs against MCP_LOOP_URL (default http://127.0.0.1:3200, the test learner on the
 * preview DB) and refuses the user's live server on :3000.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getMcpToken } from "@pramana/services";
import { chromium, type Page } from "playwright";

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const outIdx = args.indexOf("--out");
const out =
  outIdx >= 0 ? args[outIdx + 1]! : join(process.env.TMPDIR ?? "/tmp", "pramana-mcp-loop");
mkdirSync(out, { recursive: true });

// Not PRAMANA_WEB_URL: the project .env sets that to the main server.
const base = (process.env.MCP_LOOP_URL ?? "http://127.0.0.1:3200").replace(/\/$/, "");
const url = new URL(base);
if (url.port === "3000" || (url.port === "" && url.protocol === "http:")) {
  console.error(
    `refusing ${base}: the loop test runs only on a test server (e.g. :3200), never :3000`,
  );
  process.exit(2);
}
const endpoint = `${base}/api/mcp`;
const token = getMcpToken();
const stamp = new Date().toISOString().slice(11, 19);
let failures = 0;

function check(ok: boolean, what: string): void {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures++;
}

// ------------------------------------------------------------------ 1. guards
const init = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "x", version: "0" },
  },
});
const raw = (headers: Record<string, string>) =>
  fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: init,
  }).then((r) => r.status);
check((await raw({})) === 401, "no token is refused (401)");
check((await raw({ Authorization: "Bearer pmn_wrong" })) === 401, "a wrong token is refused (401)");
check(
  (await raw({ Authorization: `Bearer ${token}`, Origin: "https://attacker.example" })) === 403,
  "a foreign Origin is refused (403)",
);
// fetch cannot forge Host; the unit tests cover it (packages/services/src/local-access.test.ts).

// ------------------------------------------------------------------ 2. connect
const client = new Client({ name: "pramana-mcp-loop", version: "0.1.0" });
const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});
await client.connect(transport);
async function call<T = Record<string, unknown>>(
  name: string,
  a: Record<string, unknown> = {},
): Promise<T> {
  const result = await client.callTool({ name, arguments: a });
  const body = (result.content as { type: string; text: string }[]).map((c) => c.text).join("\n");
  if (result.isError) throw new Error(`${name}: ${body}`);
  try {
    return JSON.parse(body) as T;
  } catch {
    return body as T;
  }
}
const tools = await client.listTools();
const prompts = await client.listPrompts();
check(
  tools.tools.some((t) => t.name === "post_note"),
  `connected over HTTP: ${tools.tools.length} tools`,
);
check(
  prompts.prompts.some((p) => p.name === "explain_claim"),
  `${prompts.prompts.length} prompts`,
);
const info = await call<{ sessionId: string; transport: string; web: string }>("session_info");
check(
  info.transport === "http" && Boolean(info.sessionId),
  `session ${info.sessionId} over ${info.transport}`,
);

// Earlier runs' notes (kept with --keep) are archived first, so the pages show only this run's.
const earlier = await call<{ id: string; title: string }[]>("list_notes", { status: "shown", limit: 100 });
for (const n of earlier.filter((n) => n.title.startsWith("Loop test "))) {
  await call("archive_note", { id: n.id });
}

// What to write about: an entity with a page of its own, and a chapter of an era page.
const overview = await call<{ pages: { slug: string; kind: string; status: string }[] }>(
  "overview",
);
let chapterPage: string | null = null;
let chapter: { id: string; title: string } | null = null;
for (const p of overview.pages.filter((p) => p.status === "published")) {
  const view = await call<{ page: { blocks: { id: string; type: string; title?: string }[] } }>(
    "get_page",
    { page: p.slug, format: "json" },
  );
  const ch = view.page.blocks.find((b) => b.type === "chapter");
  if (ch) {
    chapterPage = p.slug;
    chapter = { id: ch.id, title: ch.title ?? ch.id };
    break;
  }
}
if (!chapterPage || !chapter) throw new Error("no published page with chapters in this database");
const search = await call<{ entities?: { slug: string; label: string }[] }>("search", {
  query: "Ashoka",
  types: ["entities"],
  limit: 1,
});
const entity = search.entities?.[0] ?? { slug: "ashoka", label: "Aśoka" };
console.log(
  `writing about entity "${entity.slug}" and ${chapterPage}#${chapter.id} ("${chapter.title}")`,
);

const prompt = await client.getPrompt({
  name: "explain_entity",
  arguments: { entity: entity.slug },
});
const promptText = (prompt.messages[0]?.content as { text?: string }).text ?? "";
check(promptText.includes(entity.slug), "the explain_entity prompt names the entity");

// ------------------------------------------------------------------ 3. the live event stream
/** Reads /api/events until `want` matches an event, or the time runs out. */
async function eventArrives(
  want: (e: { table: string; id?: string; op?: string }) => boolean,
  act: () => Promise<unknown>,
  ms = 15_000,
): Promise<boolean> {
  const abort = new AbortController();
  const res = await fetch(`${base}/api/events`, { signal: abort.signal });
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  const timer = setTimeout(() => abort.abort(), ms);
  let buffer = "";
  let hello = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return false;
      buffer += value;
      let cut: number;
      while ((cut = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        if (!frame.startsWith("data: ")) continue;
        const event = JSON.parse(frame.slice(6)) as { table: string; id?: string; op?: string };
        if (event.table === "hello" && !hello) {
          hello = true;
          await act();
        } else if (want(event)) return true;
      }
    }
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    abort.abort();
  }
}
let probe = "";
check(
  await eventArrives(
    (e) => e.table === "notes" && e.id === probe && e.op === "INSERT",
    async () => {
      const r = await call<{ id: string }>("post_note", {
        title: `Loop test ${stamp}: event check`,
        body: "Checks that a posted note reaches /api/events.",
        about: { type: "general" },
      });
      probe = r.id;
    },
  ),
  "a posted note reaches /api/events",
);
await call("archive_note", { id: probe });

// ------------------------------------------------------------------ 4. notes arrive live
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message.slice(0, 200)}`));

/** page.goto, retried: a dev server aborts navigations while it recompiles. */
async function open(path: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(`${base}${path}`, { waitUntil: "load", timeout: 90_000 });
      return;
    } catch (error) {
      if (attempt >= 3) throw error;
      await page.waitForTimeout(2000);
    }
  }
}

/** Opens a page, then runs `act` and waits for `text` to appear without reloading. */
async function arrivesLive(path: string, text: string, act: () => Promise<unknown>, shot: string) {
  await open(path);
  await page.waitForTimeout(2500); // let the live event stream connect
  await act();
  const found = await page
    .getByText(text, { exact: false })
    .first()
    .waitFor({ state: "visible", timeout: 45_000 })
    .then(() => true)
    .catch(() => false);
  check(found, `"${text}" appeared live on ${path}`);
  if (found) await page.getByText(text).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, shot) });
  console.log(`     screenshot ${join(out, shot)}`);
}

const posted: string[] = [];
const entityTitle = `Loop test ${stamp}: ${entity.label} at a glance`;
await arrivesLive(
  `/e/${entity.slug}`,
  entityTitle,
  async () => {
    const r = await call<{ id: string }>("post_note", {
      title: entityTitle,
      body: "A test note posted over the HTTP MCP endpoint by `scripts/dev/mcp-loop.ts`. The chart is made-up test data.",
      about: { type: "entity", entity: entity.slug },
      viz: {
        kind: "vega-lite",
        spec: {
          $schema: "https://vega.github.io/schema/vega-lite/v6.json",
          data: {
            values: [
              { step: "posted", n: 1 },
              { step: "shown", n: 2 },
              { step: "read", n: 3 },
            ],
          },
          mark: "bar",
          encoding: {
            x: { field: "step", type: "nominal", sort: null },
            y: { field: "n", type: "quantitative" },
          },
          height: 120,
        },
      },
    });
    posted.push(r.id);
  },
  "1-entity-note.png",
);

const chapterTitle = `Loop test ${stamp}: about “${chapter.title}”`;
await arrivesLive(
  `/p/${chapterPage}`,
  chapterTitle,
  async () => {
    const r = await call<{ id: string }>("post_note", {
      title: chapterTitle,
      body: "A test note anchored to one chapter. The chart is made-up test data.",
      about: { type: "page", page: chapterPage, chapter: chapter!.id },
      viz: {
        kind: "vega-lite",
        spec: {
          data: {
            values: [
              { x: 1, y: 2 },
              { x: 2, y: 3 },
              { x: 3, y: 1 },
            ],
          },
          mark: "line",
          encoding: {
            x: { field: "x", type: "quantitative" },
            y: { field: "y", type: "quantitative" },
          },
          height: 100,
        },
      },
    });
    posted.push(r.id);
  },
  "2-chapter-note.png",
);

// The history lists both.
await open("/notes");
await page.waitForTimeout(1500);
check(
  (await page.getByText(entityTitle).count()) > 0 &&
    (await page.getByText(chapterTitle).count()) > 0,
  "both notes are in /notes",
);
await page.screenshot({ path: join(out, "3-notes-history.png") });

// Presence: this session counts as connected.
await open("/connect");
const connected = await page
  .getByText("Your AI is connected", { exact: false })
  .first()
  .waitFor({ timeout: 15_000 })
  .then(() => true)
  .catch(() => false);
check(connected, "/connect says the AI is connected");
await page.screenshot({ path: join(out, "4-connect.png"), fullPage: true });

// ------------------------------------------------------------------ 5. a changeset, then withdrawn
const ent = await call<{ entity: { description: string | null } }>("get_entity", {
  entity: entity.slug,
});
const proposal = await call<{ id: string }>("propose_changes", {
  title: `Loop test ${stamp}: reword ${entity.label}'s description`,
  rationale: "Automated loop test of the HTTP MCP endpoint; it is withdrawn straight away.",
  ops: [
    {
      op: "update_entity",
      entity: entity.slug,
      set: { description: `${ent.entity.description ?? entity.label} (loop test)` },
    },
  ],
});
await open("/review");
await page.waitForTimeout(1500);
check(
  (await page.getByText(`Loop test ${stamp}: reword`).count()) > 0,
  "the proposal is listed under Review",
);
await page.screenshot({ path: join(out, "5-review.png") });
await call("withdraw_changeset", { id: proposal.id, note: "loop test done" });
await open(`/review/${proposal.id}`);
await page.waitForTimeout(1200);
check((await page.getByText(/withdrawn/i).count()) > 0, "the proposal shows as withdrawn");
await page.screenshot({ path: join(out, "6-withdrawn.png") });

// ------------------------------------------------------------------ 6. tidy up
if (!keep) for (const id of posted) await call("archive_note", { id });
await browser.close();
// End the session (HTTP DELETE), so it no longer shows as connected.
await transport.terminateSession();
await client.close();
console.log(`\n${failures ? `${failures} FAILED` : "all passed"}; screenshots in ${out}`);
process.exitCode = failures ? 1 : 0;
