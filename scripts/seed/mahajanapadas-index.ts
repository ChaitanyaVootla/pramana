/**
 * Proposes "The Mahājanapadas and the age of the Buddha" era page THROUGH
 * MCP, as the agent acting for the local user: captures the source texts,
 * creates the sources, entities (from Wikidata, with curated descriptions),
 * glossary terms, excerpts, claims, citations and relations, links
 * Cliopatria's janapada borders to their new polities, and creates the page.
 *
 * The overview needs no change: the Mahājanapadas period is already one of its
 * ages, and an age links to its page as soon as the page exists.
 *
 *   pnpm tsx scripts/seed/mahajanapadas-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { captureAll, entityOps, extentOps, mahajanapadaOps, mahajanapadaPage } from "./mahajanapadas";

const TITLE = "The Mahājanapadas and the age of the Buddha (c. 600–320 BCE): page, sources and entities";
/** The Gupta page's changeset creates the glossary term “tirthankara”, which this page reuses. */
const GUPTA_TITLE = "The Gupta Empire (c. 320–550 CE): page, sources and entities";

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  const overview = await mcp.call<{ pages: { slug: string }[] }>("overview");
  if (overview.pages.some((p) => p.slug === "mahajanapadas")) {
    console.log("The page already exists. Nothing to do.");
    process.exit(0);
  }
  if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }
  const term = await mcp.call<{ entity?: { id: string } } | null>("get_entity", { entity: "tirthankara" }).catch(() => null);
  const extraDeps: string[] = [];
  if (!term?.entity) {
    const list = await mcp.call<{ id: string; status: string; title: string }[]>("list_changesets", { status: ["proposed"], limit: 200 });
    const gupta = list.find((c) => c.title === GUPTA_TITLE);
    if (!gupta) throw new Error("the glossary term “tirthankara” is neither on the platform nor pending; run scripts/seed/gupta-index.ts first");
    extraDeps.push(gupta.id);
  }

  console.log("Capturing source texts…");
  const snaps = await captureAll(mcp);

  console.log("Checking Wikidata matches and building entities…");
  const ents = await entityOps(mcp);
  for (const r of ents.reused) console.log(`  reusing ${r}`);
  const extents = await extentOps(mcp, ents.ref);
  console.log(`  linking ${extents.length} Cliopatria janapada extents`);

  const ops = [...ents.ops, ...extents, ...mahajanapadaOps(snaps, ents.ref), mahajanapadaPage(ents.ref)];
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "A novice-first era page on the age of the sixteen great states, the Buddha and Mahāvīra, c. 600–320 BCE.",
      "**Structure.** Ten chapters (eight narrative, two “afterwards”: the Buddha's date and the misconceptions), plus:",
      "- “You may already know” and “Meanwhile, beyond the sixteen”.",
      "- Two debates: whether the clan states were democracies, and when the Buddha died.",
      "- Five misconceptions: Mahāvīra founded Jainism; the Buddha's dates are settled; the sixteen were one map at one moment; the gaṇa-saṅghas were democracies; Alexander conquered India.",
      "- Eleven new glossary terms.",
      "- An atlas spec: Magadha, Kosala, Vatsa, Avanti, Vajji and Gandhāra; Magadha's dynasties; the Achaemenid Empire; 650–300 BCE; eight stops tied to claims.",
      "Every quote was machine-checked against the same texts captured here before proposing.",
      "**Primary sources**, all public domain:",
      "- The Pāli suttas: SBE 11, 1881 (the Mahāparinibbāna and Dhammacakkappavattana suttas), and Dialogues of the Buddha I, 1899 (the Sāmaññaphala).",
      "- The Mahāvaṃsa (Geiger and Bode, 1912).",
      "- Jacobi's Jaina Sūtras (SBE 22, 1884): the Kalpa and Ācārāṅga sūtras.",
      "- Pargiter's Purāṇa text (1913).",
      "- Darius's Behistun inscription (King and Thompson, 1907).",
      "- Herodotus (Macaulay, 1890).",
      "- Arrian (Chinnock, 1884, from the Project Gutenberg transcription).",
      "- McCrindle's Curtius, Diodorus and Plutarch (1896).",
      "**Older scholarship, quoted as such:** Rhys Davids' Buddhist India (1903), and Vincent Smith (1914), tagged colonial_orientalist.",
      "**Wikipedia** (pinned revisions, tertiary) is used only for modern positions. The books it cites are added by page only.",
      "**Dates.** No Magadhan reign is given an absolute date as fact. Reign spans carry their length from the chronicles, and the basis states how the dates move with the date of the Buddha. The Buddha's own dates are a debate with three positions: the 544/543 BCE tradition; c. 486–483 (Geiger 1912, Smith 1914); and c. 400 or later (Rhys Davids 1881, the 1988 symposium).",
      "**Borders.** Cliopatria's sixteen “Janapada of …” rows were imported without entities. This changeset creates the sixteen polities, using the Wikidata QIDs Cliopatria gives for them (all checked), and links their extents with update_extent. The page and its notes say that these outlines are reconstructions from text lists.",
      "**Entities.**",
      "- Coordinates come from Wikidata only.",
      "- Wikidata's aliases are not imported.",
      "- Wikidata's life dates for Bimbisāra and Ajātaśatru are not used.",
      "- The glossary term “tirthankara” is reused from the Gupta page's changeset; this one depends on it while that is pending.",
    ].join("\n"),
    dependsOn: [...new Set([...ents.dependsOn, ...extraDeps])],
    ops,
  });
  const counts = summarize("mahajanapadas", proposal);
  console.log(`quote checks: ${JSON.stringify(counts)}`);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
