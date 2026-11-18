/**
 * Builds the demo canvas "Aśoka in context" THROUGH THE MCP SERVER, as an AI
 * acting for a test learner on the preview database: a map of 260 BCE with
 * Kalinga, the Rock Edict XIII claims and their quotation, the part on the
 * war, a timeline of the dynasty, the Dhauli picture, and a link from the
 * correction to the popular belief it corrects.
 *
 * Everything on it is existing content, found through the same tools an AI
 * would use (search, get_page, get_claim); the only new words are the
 * section titles and one short text card. Re-running replaces the canvas.
 *
 *   pnpm tsx scripts/demo/asoka-canvas.ts            # as test-learner on pramana_preview
 *   PRAMANA_USER_HANDLE=test-novice pnpm tsx scripts/demo/asoka-canvas.ts
 *
 * Then open http://127.0.0.1:3200/canvas (the test server runs as test-learner).
 */
import { connectMcp } from "../lib/mcp-client";

const PREVIEW = "postgres://pramana:pramana@127.0.0.1:5442/pramana_preview";
process.env.DATABASE_URL ??= PREVIEW;
process.env.PRAMANA_USER_HANDLE ??= "test-learner";
process.env.PRAMANA_USER_NAME ??= "Test learner (preview)";
process.env.PRAMANA_AGENT_HANDLE ??= "claude-code";
if (!/pramana_preview/.test(process.env.DATABASE_URL)) {
  console.error("Refusing to run: the demo canvas is for the preview database (DATABASE_URL must name pramana_preview).");
  process.exit(1);
}

const TITLE = "Aśoka in context";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

interface Hit { id: string; slug?: string; text?: string; kind?: string }
interface ClaimDetail {
  claim: { id: string; text: string; kind: string; citations: { excerpt: { id: string; quote: string | null } }[] };
  relations: { type: string; direction: "in" | "out"; other: { id: string; text: string } }[];
}

const mcp = await connectMcp("demo-asoka-canvas");
try {
  // An earlier run's canvas is emptied and reused, so its address stays the same.
  const mine = await mcp.call<{ id: string; title: string }[]>("canvas_list");
  const [earlier, ...extra] = mine.filter((c) => c.title === TITLE);
  for (const c of extra) await mcp.call("canvas_delete", { canvas: c.id });

  // The part on the war, from the page as an AI reads it.
  const page = await mcp.call<string>("get_page", { page: "maurya-empire" });
  const start = page.indexOf("[block ch-kalinga]");
  const end = page.indexOf("[block ch-", start + 20);
  if (start < 0) throw new Error("the Maurya page has no part ch-kalinga");
  const part = page.slice(start, end < 0 ? undefined : end);
  const claimIds = [...new Set([...part.matchAll(/claim[: ](0[0-9a-f-]{35})/g)].map((m) => m[1]!))];
  const mediaId = /\(media (0[0-9a-f-]{35})/.exec(part)?.[1];
  if (!claimIds.length) throw new Error("no claims found in the part on Kalinga");

  // The claims, with their evidence, and the popular belief the page corrects.
  const details = await Promise.all(claimIds.map((id) => mcp.call<ClaimDetail>("get_claim", { id })));
  const toll = details.find((d) => /toll|150,000/i.test(d.claim.text)) ?? details[0]!;
  const tollQuote = toll.claim.citations.find((c) => c.excerpt.quote)?.excerpt.id;
  const search = await mcp.call<{ claims: Hit[] }>("search", { query: "Kalinga Buddhist suddenly", types: ["claims"], limit: 5 });
  const belief = search.claims.find((c) => c.kind === "misconception");
  const beliefDetail = belief ? await mcp.call<ClaimDetail>("get_claim", { id: belief.id }) : null;
  const correction = beliefDetail?.relations.find((r) => r.type === "corrects" && r.direction === "in")?.other;

  const edictClaims = details.map((d) => d.claim.id).filter((id) => id !== belief?.id);
  const description =
    "The Kalinga war as Aśoka himself told it: where, when, the edict's own words, and what is often said instead.";
  let created: { id: string; url: string };
  if (earlier) {
    const old = await mcp.call<{ items: { id: string }[]; url: string }>("canvas_get", { canvas: earlier.id });
    if (old.items.length) await mcp.call("canvas_remove_items", { canvas: earlier.id, items: old.items.map((i) => i.id) });
    await mcp.call("canvas_update", { canvas: earlier.id, description });
    created = { id: earlier.id, url: old.url };
  } else created = await mcp.call<{ id: string; url: string }>("canvas_create", { title: TITLE, description });
  const canvas = created.id;

  // Three columns, each under its own section: where and when; his own words; what is often said.
  const others = edictClaims.filter((id) => id !== toll.claim.id);
  const partY = 9 + Math.ceil(others.length / 2) * 4;
  const added = await mcp.call<{ added: string[] }>("canvas_add_items", {
    canvas,
    items: [
      { content: { kind: "section", title: "Where and when" }, layout: { x: 0, y: 0, w: 10, h: 1 } },
      {
        content: {
          kind: "map",
          title: "Kalinga, 260 BCE",
          year: -259,
          range: [-300, -230],
          places: ["kalinga", "dhauli", "jaugada", "pataliputra"],
          focus: ["maurya-empire"],
        },
        layout: { x: 0, y: 1, w: 10, h: 10 },
      },
      {
        content: {
          kind: "timeline",
          title: "The Maurya dynasty",
          range: [-340, -170],
          entities: ["chandragupta-maurya", "bindusara", "ashoka", "kalinga-war", "maurya-empire"],
          year: -259,
        },
        layout: { x: 0, y: 11, w: 10, h: 6 },
      },
      ...(mediaId ? [{ content: { kind: "media", mediaId }, layout: { x: 0, y: 17, w: 10, h: 8 } }] : []),

      { content: { kind: "section", title: "In his own words" }, layout: { x: 11, y: 0, w: 10, h: 1 } },
      // The toll claim with its sources and the quotation beside it; the other claims under them; then the part.
      { content: { kind: "claim", claimId: toll.claim.id, citations: true }, layout: { x: 11, y: 1, w: 5, h: 8 } },
      ...(tollQuote ? [{ content: { kind: "excerpt", excerptId: tollQuote }, layout: { x: 16, y: 1, w: 5, h: 8 } }] : []),
      ...others.map((claimId, i) => ({
        content: { kind: "claim", claimId, citations: false },
        layout: { x: 11 + (i % 2) * 5, y: 9 + Math.floor(i / 2) * 4, w: 5, h: 4 },
      })),
      {
        content: { kind: "chapter", page: "maurya-empire", chapterId: "ch-kalinga", show: "brief" },
        layout: { x: 11, y: partY, w: 10, h: 9 },
      },

      { content: { kind: "section", title: "What is often said" }, layout: { x: 22, y: 0, w: 8, h: 1 } },
      ...(belief ? [{ content: { kind: "claim", claimId: belief.id, citations: false }, layout: { x: 22, y: 1, w: 8, h: 4 } }] : []),
      ...(correction
        ? [{ content: { kind: "claim", claimId: correction.id, citations: false }, layout: { x: 22, y: 6, w: 8, h: 4 } }]
        : []),
      {
        content: {
          kind: "text",
          title: "To look at",
          markdown:
            "Compare the edict's own account with the popular story of a sudden conversion on the battlefield. Which claims rest on the inscription itself?",
        },
        layout: { x: 22, y: 11, w: 8, h: 4 },
      },
    ],
  });

  // The correction contradicts the belief (the page records it as "corrects").
  const view = await mcp.call<{ items: { id: string; claim?: { id: string } }[]; notes: unknown[] }>("canvas_get", { canvas });
  const itemFor = (claimId: string | undefined) => view.items.find((i) => i.claim?.id === claimId)?.id;
  const from = itemFor(correction?.id);
  const to = itemFor(belief?.id);
  if (from && to)
    await mcp.call("canvas_link", { canvas, links: [{ from, to, relation: "contradicts", label: "the edict says otherwise" }] });

  // The AI's own explanation of how the pieces connect, as a note about the canvas (once per canvas).
  if (!view.notes.length)
    await mcp.call("post_note", {
      title: "How these pieces connect",
      body: `The map shows where Kalinga lay at the empire's edge in 260 BCE. [The toll](claim:${toll.claim.id}) comes from Aśoka's own edict, quoted beside it${
        belief
          ? `. The page records the [story of a sudden conversion](claim:${belief.id}) as a popular belief${correction ? ` and [corrects it](claim:${correction.id})` : ""}`
          : ""
      }. Compare them under "What is often said".`,
      about: { type: "canvas", id: canvas },
    });

  console.log(`"${TITLE}": ${added.added.length} items${from && to ? ", 1 link" : ""}`);
  console.log(`open ${created.url.replace("localhost:3000", "127.0.0.1:3200")}`);
  if (!UUID.test(canvas)) throw new Error("unexpected canvas id");
} finally {
  await mcp.close();
}
