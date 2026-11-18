/**
 * Seeds the first content THROUGH THE MCP SERVER, as the agent (claude-code)
 * acting for the local user: the same tools, validation, dry runs and audit
 * trail as an interactive session. The result is a set of PROPOSED changesets
 * for the user to review at /review; nothing is applied.
 *
 *   pnpm seed                    # propose (normal use)
 *   pnpm seed --approve-preview  # also apply, as a system actor; only allowed
 *                                # when DATABASE_URL names a *preview* database
 */
import { connectMcp } from "../lib/mcp-client";
import { mauryaOps, type MauryaSnapshots, type Places } from "./maurya";
import { spineOps } from "./spine";

interface SnapshotSummary {
  id: string;
  url: string | null;
  meta: { wikipedia?: { revisionId: number } };
}
interface Proposal {
  id: string;
  report: {
    outcomes: unknown[];
    excerptChecks: { excerptId: string; status: string; score?: number; matchedText?: string }[];
    claims: {
      claimId: string;
      level: number;
      issues: { severity: string; code: string; message: string }[];
    }[];
  };
  refs: Record<string, string>;
  review: string;
}

const approvePreview = process.argv.includes("--approve-preview");
const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
if (approvePreview && !dbName.includes("preview")) {
  console.error(
    "--approve-preview is only allowed against a database whose name contains 'preview'.",
  );
  process.exit(1);
}

const mcp = await connectMcp("pramana-seed");
try {
  const overview = await mcp.call<{
    pages: { slug: string }[];
    pendingChangesets: { title: string }[];
  }>("overview");
  if (
    overview.pages.some((p) => p.slug === "maurya-empire") ||
    overview.pendingChangesets.some((c) => c.title.startsWith("Maurya Empire"))
  ) {
    console.log("Already seeded (or waiting for review). Nothing to do.");
    process.exit(0);
  }

  console.log("Capturing source texts…");
  const ia = (identifier: string) =>
    mcp.call<SnapshotSummary>("capture_snapshot", {
      origin: { kind: "internet_archive", identifier },
    });
  const wp = async (title: string) => {
    const snap = await mcp.call<SnapshotSummary>("capture_snapshot", {
      origin: { kind: "wikipedia", title },
    });
    return { id: snap.id, revisionId: snap.meta.wikipedia!.revisionId, url: snap.url! };
  };
  const snaps: MauryaSnapshots = {
    hultzsch: (await ia("InscriptionsOfAsoka.NewEditionByE.Hultzsch")).id,
    mccrindle: (await ia("AncientIndiaAsDescribedByMegasthenesAndArrian")).id,
    shamasastry: (await ia("kautilyas-arthashastra")).id,
    wpMaurya: await wp("Maurya Empire"),
    wpArthashastra: await wp("Arthashastra"),
    wpEdicts: await wp("Edicts of Ashoka"),
    wpSlavery: await wp("Slavery in India"),
  };

  console.log("Looking up places on Wikidata…");
  const placeTitles: Record<string, string> = {
    pataliputra: "Pataliputra",
    lumbini: "Lumbini",
    dhauli: "Dhauli",
    kalsi: "Kalsi",
    topra: "Feroz Shah Kotla",
    rupnath: "Rupnath",
  };
  const places: Places = {};
  for (const [slug, title] of Object.entries(placeTitles)) {
    const wd = await mcp
      .call<{ qid: string; coordinates: { lat: number; lon: number } | null } | null>("wikidata", {
        wikipediaTitle: title,
      })
      .catch(() => null);
    if (wd?.coordinates)
      places[slug] = {
        lon: wd.coordinates.lon,
        lat: wd.coordinates.lat,
        ...(slug === "pataliputra" || slug === "lumbini" ? { wikidataId: wd.qid } : {}),
      };
    else console.log(`  no coordinates for ${title}; the entity will have no location`);
  }

  console.log("Proposing the timeline spine…");
  const spine = await mcp.call<Proposal>("propose_changes", {
    title: "Ages of Indian history: the timeline spine",
    rationale:
      "Creates the ages of Indian history as dated entities (identity and multilingual names from Wikidata; period boundaries are editorial conventions, each with its basis recorded) and an overview page with a timeline.",
    ops: await spineOps(mcp),
  });
  summarize("spine", spine);

  console.log("Proposing the Maurya Empire page…");
  const maurya = await mcp.call<Proposal>("propose_changes", {
    title: "Maurya Empire page, with sources",
    rationale:
      "First fully sourced era page. Primary sources are public-domain translations captured from the Internet Archive (Hultzsch 1925 for the inscriptions, McCrindle 1877 for Megasthenes, Shamasastry 1915 for the Arthaśāstra); every quote was located in those snapshots. Overview claims cite pinned Wikipedia revisions (tertiary) and are flagged as such. Modern scholarship on the Arthaśāstra's date (Olivelle 2013, Trautmann 1971) is cited by location only, as found via Wikipedia.",
    dependsOn: [spine.id],
    ops: mauryaOps(snaps, places),
  });
  summarize("maurya", maurya);

  if (approvePreview) {
    const svc = await import("@pramana/services");
    const ctx = await svc.systemContext("seed-preview", "system");
    const result = await svc.approveChangeset(ctx, maurya.id, {
      withDependencies: true,
      allowSystem: true,
      note: "Applied automatically in a preview database.",
    });
    console.log("preview approval:", result);
  } else {
    console.log(`\nReview and approve: ${spine.review.replace(spine.id, "")}`);
  }
} finally {
  await mcp.close();
  if (approvePreview) (await import("@pramana/db")).closeDb();
}

function summarize(name: string, p: Proposal) {
  const checks = p.report.excerptChecks;
  const counts = checks.reduce<Record<string, number>>(
    (acc, c) => ((acc[c.status] = (acc[c.status] ?? 0) + 1), acc),
    {},
  );
  console.log(
    `  ${name}: changeset ${p.id}, ${p.report.outcomes.length} ops, quotes ${JSON.stringify(counts)}`,
  );
  for (const c of checks) {
    if (c.status === "not_found")
      console.log(`    NOT FOUND excerpt ${c.excerptId} (score ${c.score})`);
    if (c.status === "fuzzy")
      console.log(
        `    fuzzy ${Math.round((c.score ?? 0) * 100)}%: “${c.matchedText?.replace(/\s+/g, " ").slice(0, 120)}”`,
      );
  }
  const refName = Object.fromEntries(Object.entries(p.refs).map(([k, v]) => [v, k]));
  for (const cl of p.report.claims) {
    const warnings = cl.issues.filter((i) => i.severity === "warning");
    if (warnings.length)
      console.log(
        `    ${refName[cl.claimId] ?? cl.claimId} L${cl.level}: ${warnings.map((w) => w.code).join(", ")}`,
      );
  }
}
