/**
 * Proposes "Kingdoms of the early medieval age and the Cholas" era page
 * THROUGH MCP, as the agent acting for the local user: captures the source
 * texts, creates the sources, entities (from Wikidata, with curated
 * descriptions), glossary terms, excerpts, claims, citations and relations,
 * links two Cliopatria border series the importer left unlinked (Harṣa's
 * kingdom, Śrīvijaya), and creates the page.
 *
 * The overview needs no change: "Early medieval India" is already one of its
 * ages, and an age links to its page as soon as the page exists.
 *
 *   pnpm tsx scripts/seed/early-medieval-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { captureAll, earlyMedievalOps, earlyMedievalPage, entityOps, extentOps } from "./early-medieval";

const TITLE = "Kingdoms of the early medieval age and the Cholas (c. 550–1200 CE): page, sources and entities";
/** The Gupta page's changeset creates entities this page reuses by slug (prashasti, kalidasa, nalanda, mihirakula). */
const GUPTA_TITLE = "The Gupta Empire (c. 320–550 CE): page, sources and entities";
const FROM_GUPTA = ["prashasti", "kalidasa", "nalanda", "mihirakula"];

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  const overview = await mcp.call<{ pages: { slug: string }[] }>("overview");
  if (overview.pages.some((p) => p.slug === "early-medieval-kingdoms")) {
    console.log("The page already exists. Nothing to do.");
    process.exit(0);
  }
  if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }
  const extraDeps: string[] = [];
  for (const slug of FROM_GUPTA) {
    const found = await mcp.call<{ entity?: { id: string } } | null>("get_entity", { entity: slug }).catch(() => null);
    if (found?.entity) continue;
    const list = await mcp.call<{ id: string; title: string }[]>("list_changesets", { status: ["proposed"], limit: 200 });
    const gupta = list.find((c) => c.title === GUPTA_TITLE);
    if (!gupta) throw new Error(`“${slug}” is neither on the platform nor pending; run scripts/seed/gupta-index.ts first`);
    extraDeps.push(gupta.id);
    break;
  }

  console.log("Capturing source texts…");
  const snaps = await captureAll(mcp);

  console.log("Checking Wikidata matches and building entities…");
  const ents = await entityOps(mcp);
  for (const r of ents.reused) console.log(`  reusing ${r}`);
  const extents = await extentOps(mcp, ents.ref);
  console.log(`  linking ${extents.length} Cliopatria extents`);

  const ops = [...ents.ops, ...extents, ...earlyMedievalOps(snaps, ents.ref), earlyMedievalPage(ents.ref)];
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "A novice-first era page on the regional kingdoms of c. 550–1200 CE, from Harṣa to the Cholas.",
      "**Structure.** Ten chapters: seven narrative (Harṣa; Chalukyas and Pallavas; Kannauj; Rājarāja; Rājendra; village assemblies; Mahmud), plus the feudalism debate, “How we know”, and the misconceptions. Also:",
      "- “You may already know” and “Meanwhile, beyond India”.",
      "- Three debates: the Chola attack on Śrīvijaya, how centralised the Chola state was, and Indian feudalism.",
      "- Five misconceptions: a Chola empire in South-East Asia, Chola village democracy, the post-Gupta “dark age”, the Rājataraṅgiṇī as reliable from its first book, and a single motive for Mahmud's raids.",
      "- Nine glossary terms.",
      "- An atlas spec: the Cholas, Rāṣṭrakūṭas, Pālas, Pratihāras, both Chalukyas, the Pallavas, Harṣa's kingdom, Śrīvijaya and the Ghaznavids; 550–1250 CE; twelve stops tied to claims.",
      "Every quote was machine-checked against the same texts captured here before proposing.",
      "**Primary sources**, all public domain:",
      "- Hultzsch's South Indian Inscriptions I–II (the Thanjavur temple records of Rājarāja I and Rājendra I, Pallava grants).",
      "- Epigraphia Indica IV, VI and IX: Kielhorn's Khalimpur plate of Dharmapāla and Aihole inscription of Pulakeśin II; Hultzsch's Tirumalai inscription of Rājendra I.",
      "- The Uttaramerūr inscriptions (ASI Annual Report 1904–5).",
      "- Bāṇa's Harṣacarita (Cowell and Thomas, 1897).",
      "- Xuanzang (Beal, 1884).",
      "- Sulaimān and the chroniclers of Mahmud in Elliot and Dowson I–II (1867–69).",
      "- Alberuni (Sachau, 1888).",
      "- Kalhaṇa (Stein, 1900).",
      "S. K. Aiyangar (1911) is older scholarship; his four-mile ramp is recorded as a tradition (assessment weak).",
      "**Source criticism on the page:**",
      "- Elliot's stated colonial purpose is quoted from his own preface.",
      "- Sulaimān is flagged as a translation of Reinaud's French.",
      "- The Somnāth slaughter is attributed to Ibn al-Athīr, writing two centuries later.",
      "- ʿUtbī's contemporary history is noted as ending before Somnāth.",
      "- Hultzsch's 1892 placing of Kaḍāram in south India, and his later correction, are both shown.",
      "**Wikipedia** (pinned revisions, tertiary) supplies modern positions: reign dates, the Kannauj wars, the Śrīvijaya debate, Burton Stein, R. S. Sharma's feudalism, Thapar on Somnāth, and the reliability of the Rājataraṅgiṇī. The opposing views in two debates (a centralised Chola state; Sharma's critics) are named as not yet quoted.",
      "**Borders.** Cliopatria's “Harsha's Empire” and “Srivijaya” rows were imported without entities. This changeset creates those polities (Wikidata Q28109312, Q234197) and links their extents. The other focus polities reuse the entities from the borders import.",
      "**Entities.** Coordinates come from Wikidata only. Kaḍāram uses Kedah's coordinates, marked approximate, with a note.",
    ].join("\n"),
    dependsOn: [...new Set([...ents.dependsOn, ...extraDeps])],
    ops,
  });
  const counts = summarize("early medieval", proposal);
  console.log(`quote checks: ${JSON.stringify(counts)}`);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
