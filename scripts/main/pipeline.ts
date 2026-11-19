/**
 * Runs the follow-up scripts against a database in a fixed order and approves
 * what they propose as it goes, so no page edit waits behind another and goes
 * stale. Approvals are made by the agent under the user's standing delegation
 * (services/delegation.ts): each one is recorded as delegated, never as the
 * user's own review.
 *
 *   pnpm tsx scripts/main/pipeline.ts                 # approve pending, then run every step
 *   pnpm tsx scripts/main/pipeline.ts --approve-only  # just approve what is pending
 *   pnpm tsx scripts/main/pipeline.ts --from media-maurya
 *
 * Steps are idempotent: re-running proposes nothing for work already applied.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  activeApprovalDelegation,
  approveChangeset,
  grantApprovalDelegation,
  startAgentSession,
  type ActorContext,
} from "@pramana/services";
import { changesets, closeDb, getDb } from "@pramana/db";
import { and, asc, eq, gt } from "drizzle-orm";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The user's instruction, verbatim, recorded with the delegation. */
const INSTRUCTION =
  "also auto approve things for me all of them dont wait for me and you seem to be doing things a bit ineffecient set yourself scripts and processes to do things more effeceintly";

/** In order: copy edits first (they reword claims later steps link to), then structure, pictures, learning, briefs last. */
const STEPS: { name: string; args: string[] }[] = [
  // Content agents' claim fixes (each finds its dependencies and skips what is applied).
  { name: "gupta-joint-fixes", args: ["scripts/seed/gupta-joint-fixes.ts"] },
  { name: "gupta-round3-fixes", args: ["scripts/seed/gupta-round3-fixes.ts"] },
  { name: "early-medieval-sources", args: ["scripts/seed/early-medieval-sources.ts"] },
  { name: "early-medieval-support-fixes", args: ["scripts/seed/early-medieval-support-fixes.ts"] },
  { name: "early-medieval-extents", args: ["scripts/seed/early-medieval-extents.ts"] },
  { name: "indus-fixes2", args: ["scripts/seed/indus-fixes2.ts"] },
  { name: "indus-sources2", args: ["scripts/seed/indus-sources2.ts"] },
  { name: "vedic-fixes", args: ["scripts/seed/vedic-fixes.ts"] },
  { name: "vedic-fixes2", args: ["scripts/seed/vedic-fixes2.ts"] },
  { name: "vedic-sources", args: ["scripts/seed/vedic-sources.ts"] },
  { name: "vedic-sources2", args: ["scripts/seed/vedic-sources2.ts"] },
  { name: "learning-fixes", args: ["scripts/seed/learning-fixes.ts"] },
  { name: "independence-fixes", args: ["scripts/seed/independence-fixes.ts"] },
  { name: "last-support-fixes", args: ["scripts/seed/last-support-fixes.ts"] },
  { name: "copyedit-independence", args: ["scripts/seed/copyedit-independence.ts"] },
  { name: "copyedit-maurya", args: ["scripts/seed/copyedit-maurya.ts"] },
  { name: "copyedit-gupta", args: ["scripts/seed/copyedit-gupta.ts"] },
  { name: "copyedit-indus", args: ["scripts/seed/copyedit-indus.ts"] },
  { name: "copyedit-mahajanapadas", args: ["scripts/seed/copyedit-mahajanapadas.ts"] },
  { name: "copyedit-vedic", args: ["scripts/seed/copyedit-vedic.ts"] },
  { name: "copyedit-early-medieval", args: ["scripts/seed/copyedit-early-medieval.ts"] },
  { name: "copyedit-terms", args: ["scripts/seed/copyedit-terms.ts"] },
  { name: "copyedit-ages", args: ["scripts/seed/copyedit-ages.ts"] },
  { name: "indus-sources", args: ["scripts/seed/indus-sources.ts"] },
  { name: "indus-fixes", args: ["scripts/seed/indus-fixes.ts"] },
  { name: "maurya-kalinga-places", args: ["scripts/seed/maurya-kalinga-places.ts"] },
  { name: "place-dates", args: ["scripts/import/place-dates.ts"] },
  { name: "page-specs", args: ["scripts/seed/page-specs.ts"] },
  { name: "media-entities", args: ["scripts/seed/media-entities.ts"] },
  { name: "media-maurya", args: ["scripts/seed/media-maurya.ts"] },
  { name: "media-independence", args: ["scripts/seed/media-independence.ts"] },
  { name: "media-gupta", args: ["scripts/seed/media-gupta.ts"] },
  { name: "media-indus", args: ["scripts/seed/media-indus.ts"] },
  { name: "media-mahajanapadas", args: ["scripts/seed/media-mahajanapadas.ts"] },
  { name: "media-vedic", args: ["scripts/seed/media-vedic.ts"] },
  { name: "media-early-medieval", args: ["scripts/seed/media-early-medieval.ts"] },
  { name: "learn-places", args: ["scripts/seed/learn-places.ts"] },
  // Prompts first: guesses and checks need their claims' recall prompts.
  { name: "learn-prompts", args: ["scripts/seed/learn-prompts.ts"] },
  { name: "learn-index", args: ["scripts/seed/learn-index.ts"] },
  { name: "copyedit-briefs", args: ["scripts/seed/copyedit-briefs.ts"] },
  { name: "retire-duplicate-excerpts", args: ["scripts/seed/retire-duplicate-excerpts.ts"] },
  // Drought, famine and everyday life: three period pages, then the page across the ages built from their cells.
  { name: "famine-early", args: ["scripts/seed/famine-early-index.ts"] },
  { name: "famine-medieval", args: ["scripts/seed/famine-medieval-index.ts"] },
  { name: "famine-british", args: ["scripts/seed/famine-british-index.ts"] },
  { name: "famine-british-media", args: ["scripts/seed/famine-british-media.ts"] },
  { name: "famine-across-ages", args: ["scripts/seed/famine-across-ages.ts"] },
];

async function ensureDelegation(ctx: ActorContext): Promise<void> {
  if (await activeApprovalDelegation(ctx.onBehalfOfId!)) return;
  await grantApprovalDelegation(ctx, INSTRUCTION);
  console.log("Recorded the user's standing approval delegation.");
}

function hashOps(ops: unknown): string {
  return createHash("sha256").update(JSON.stringify(ops)).digest("hex");
}

/** Approve every proposed changeset, oldest first (dependencies come along). Returns failures. */
async function approvePending(ctx: ActorContext): Promise<string[]> {
  const failures: string[] = [];
  for (;;) {
    const rows = await getDb()
      .select({ id: changesets.id, title: changesets.title, ops: changesets.ops })
      .from(changesets)
      .where(eq(changesets.status, "proposed"))
      .orderBy(asc(changesets.createdAt));
    if (!rows.length) return failures;
    let progressed = false;
    for (const row of rows) {
      // A script that keeps proposing the same change is looping (two scripts undoing each other): stop and report.
      // Same title with different ops is a new round of edits, not a loop.
      const opsHash = hashOps(row.ops);
      const sameTitle = await getDb()
        .select({ ops: changesets.ops })
        .from(changesets)
        .where(
          and(
            eq(changesets.title, row.title),
            eq(changesets.status, "applied"),
            gt(changesets.createdAt, new Date(Date.now() - 24 * 3600 * 1000)),
          ),
        );
      const repeats = sameTitle.filter((r) => hashOps(r.ops) === opsHash);
      if (repeats.length >= 2) {
        failures.push(`${row.title}: not approved, already applied ${repeats.length} times today (a script is looping)`);
        console.log(`  HELD: ${row.title} (applied ${repeats.length}× today)`);
        continue;
      }
      try {
        const r = await approveChangeset(ctx, row.id, { delegated: true, withDependencies: true });
        if (r.status === "applied") {
          progressed = true;
          console.log(`  approved: ${row.title}`);
        } else {
          failures.push(`${row.title}: ${r.error}`);
          console.log(`  FAILED: ${row.title}: ${r.error?.slice(0, 300)}`);
        }
      } catch (error) {
        // Already decided by a dependency's approval, or a status race: skip.
        const message = error instanceof Error ? error.message : String(error);
        if (!/is applied|is failed|is withdrawn|is rejected/.test(message)) {
          failures.push(`${row.title}: ${message}`);
          console.log(`  skipped: ${row.title}: ${message.slice(0, 200)}`);
        }
      }
    }
    if (!progressed) return failures;
  }
}

// Longer through a tunnel to a remote database (deploy/content.sh sets it).
const STEP_TIMEOUT_MS = Number(process.env.PRAMANA_STEP_TIMEOUT_MS) || 10 * 60 * 1000;

function run(step: { name: string; args: string[] }): boolean {
  console.log(`\n=== ${step.name}`);
  // tsx's entry point through node, not node_modules/.bin/tsx (a shell script Windows cannot spawn).
  const tsx = join(root, "node_modules", "tsx", "dist", "cli.mjs");
  const r = spawnSync(process.execPath, [tsx, ...step.args], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    // A step that hangs (a stalled Wikidata fetch) must not hold up the rest.
    timeout: STEP_TIMEOUT_MS,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const lines = out
    .split("\n")
    .filter((l) => /changeset|Nothing|nothing|rror|left as it is|Proposed|skip/i.test(l))
    .slice(0, 12);
  for (const l of lines) console.log(`  ${l.trim().slice(0, 240)}`);
  if (r.signal === "SIGTERM") console.log(`  (stopped after ${STEP_TIMEOUT_MS / 60000} min)`);
  else if (r.status !== 0) console.log(`  (exit ${r.status})`);
  return r.status === 0;
}

/** One run at a time: two runs propose the same edits twice and the second copy goes stale. */
// Outside the repo: the dev servers watch it, and any file written there reloads open pages.
const LOCK = join(tmpdir(), "pramana-pipeline.lock");
function takeLock(): boolean {
  try {
    writeFileSync(LOCK, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    const pid = Number(readFileSync(LOCK, "utf8"));
    try {
      process.kill(pid, 0);
      return false; // still running
    } catch {
      writeFileSync(LOCK, String(process.pid)); // left by a run that died
      return true;
    }
  }
}
if (!takeLock()) {
  console.log("Another pipeline run is going; not starting a second one.");
  process.exit(0);
}
process.on("exit", () => rmSync(LOCK, { force: true }));

// Marked as automation: it is not the reader's AI, so it never shows as connected.
const ctx = await startAgentSession({
  client: { name: "main-pipeline", version: "1" },
  meta: { automation: "pipeline" },
});
await ensureDelegation(ctx);
const fromIdx = process.argv.includes("--from") ? STEPS.findIndex((s) => s.name === process.argv[process.argv.indexOf("--from") + 1]) : 0;
const failures: string[] = [];

console.log("Approving what is pending…");
failures.push(...(await approvePending(ctx)));

if (!process.argv.includes("--approve-only")) {
  for (const step of STEPS.slice(Math.max(0, fromIdx))) {
    if (!run(step)) failures.push(`${step.name}: script failed`);
    failures.push(...(await approvePending(ctx)));
  }
}

console.log(failures.length ? `\nDone with ${failures.length} problem(s):\n- ${failures.join("\n- ")}` : "\nDone: everything applied.");
await closeDb();
