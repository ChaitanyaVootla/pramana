/**
 * An AI tailoring a page for a learner, THROUGH THE MCP SERVER, on the preview
 * database: what an assistant might do after a quiz shows the learner believed
 * that Aśoka converted suddenly on the battlefield. It opens the Maurya page on
 * the short versions, marks the correction to come back to, pins a study note
 * to the part on Kalinga, and keeps the map's turning points. Everything is
 * the learner's own view: the page itself is not changed, and the learner sees
 * "Your AI changed this view" with Undo.
 *
 *   pnpm tsx scripts/demo/tailor-view.ts           # as test-learner
 *   pnpm tsx scripts/demo/tailor-view.ts --undo    # the AI takes its last change back
 *
 * Running it again reuses its note (the one already on the part) rather than posting another.
 */
import { connectMcp } from "../lib/mcp-client";

process.env.DATABASE_URL ??= "postgres://pramana:pramana@127.0.0.1:5442/pramana_preview";
process.env.PRAMANA_USER_HANDLE ??= "test-learner";
process.env.PRAMANA_USER_NAME ??= "Test learner (preview)";
if (!/pramana_preview/.test(process.env.DATABASE_URL)) {
  console.error("Refusing to run: this demo is for the preview database.");
  process.exit(1);
}

const mcp = await connectMcp("demo-tailor-view");
try {
  if (process.argv.includes("--undo")) {
    const r = await mcp.call<{ summary: string[] }>("view_undo", { subject: "page", ref: "maurya-empire" });
    console.log("undone; the view now:", r.summary.join("; ") || "as published");
  } else {
    const search = await mcp.call<{ claims: { id: string; kind: string }[] }>("search", {
      query: "Kalinga Buddhist suddenly",
      types: ["claims"],
      limit: 5,
    });
    const belief = search.claims.find((c) => c.kind === "misconception");
    if (!belief) throw new Error("the misconception about a sudden conversion was not found");
    const detail = await mcp.call<{ relations: { type: string; direction: string; other: { id: string } }[] }>("get_claim", {
      id: belief.id,
    });
    const correction = detail.relations.find((r) => r.type === "corrects" && r.direction === "in")?.other.id;

    // A short explainer, in the AI's own words, pinned to the part (a note, not page content).
    // Once: an earlier run's note, still shown, is the one pinned again.
    const title = "Why the battlefield story is doubted";
    const earlier = await mcp.call<{ id: string; title: string; chapter: string | null }[]>("list_notes", {
      about: "page",
      id: "maurya-empire",
      limit: 100,
    });
    const note =
      earlier.find((n) => n.title === title) ??
      (await mcp.call<{ id: string }>("post_note", {
        title,
        body: `The popular story is that [Aśoka converted in a moment of horror at Kalinga](claim:${belief.id}). The edict itself ${
          correction ? `[tells it differently](claim:${correction})` : "tells it differently"
        }: read the part's short version, then the edict's own words.`,
        about: { type: "page", page: "maurya-empire", chapter: "ch-kalinga" },
      }));
    const r = await mcp.call<{ summary: string[]; url: string }>("view_set", {
      subject: "page",
      ref: "maurya-empire",
      why: "You believed the battlefield conversion story; this brings the edict's own account forward.",
      changes: {
        reading: "skim",
        emphasis: ["kalinga", "ashoka"],
        highlights: correction ? [{ claimId: correction, tone: "question" }] : [],
        pinnedNotes: [{ noteId: note.id, blockId: "ch-kalinga" }],
      },
    });
    console.log("tailored:", r.summary.join("; "));
    console.log(`open ${r.url.replace("localhost:3000", "127.0.0.1:3200")}`);
  }
} finally {
  await mcp.close();
}
