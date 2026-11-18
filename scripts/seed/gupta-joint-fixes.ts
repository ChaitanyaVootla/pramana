/**
 * Accuracy fixes to the Gupta Empire page after the verifier's JOINT support
 * checks (all of a claim's citations judged together; joint-preview.json and
 * joint-r3.json), which found 14 claims only partly carried:
 *
 * - claims that said more than their quotes are reworded (Clark's 499 as
 *   conditional on the Kali Yuga epoch, Saurashtra without Gujarat, Smith
 *   “reckoned” not “stretched”, Cosmas a former merchant probably of
 *   Alexandria, the Sanchi donor “apparently” an officer, Samudragupta
 *   embraced rather than chosen, the Alchon identification, Āryabhaṭa's
 *   Kusumapura school);
 * - the missing steps get excerpts (Cosmas's date, the Junāgaḍh burst, the
 *   Mandasor repair, Ryder on Ujjain, Toramāṇa as a Hūṇa, his coins, the
 *   Udayagiri gift).
 *
 * Proposed THROUGH MCP, depending on the page's changeset, its sources
 * follow-up and the first support-fix changeset. Claims and citations are
 * found on the live page by their text; anything already fixed is skipped,
 * so the script can be re-run.
 *
 *   pnpm tsx scripts/seed/gupta-joint-fixes.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import type { BlockInput, ChangeOpInput } from "@pramana/core";
import { alreadyProposedOrApplied } from "../lib/claim-fixes";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, summarize, type Proposal } from "../lib/proposal";

const TITLE = "The Gupta Empire page: fixes after the joint support checks";
const DEPENDS = [
  "The Gupta Empire (c. 320–550 CE): page, sources and entities",
  "The Gupta Empire: older sources for five claims that rested on Wikipedia",
  "The Gupta Empire page: fixes after the AI support checks",
];

const CAPTURES = {
  fleet: { kind: "internet_archive", identifier: "dli.csl.8714" },
  clark: { kind: "internet_archive", identifier: "TheAryabhatiyaOfAryabhata" },
  ryder: { kind: "internet_archive", identifier: "kalidasatranslat00kali" },
  cosmas: { kind: "internet_archive", identifier: "christiantopogra00cosm" },
  wpAlchon: { kind: "wikipedia", title: "Alchon Huns" },
  wpHephthalites: { kind: "wikipedia", title: "Hephthalites" },
} as const;
type Key = keyof typeof CAPTURES;

interface Citation {
  id: string;
  stance: string;
  note: string | null;
  excerpt: { id: string; quote: string | null };
}
interface ClaimView {
  id: string;
  text: string;
  citations: Citation[];
}
interface PageView {
  page: { version: number; blocks: BlockInput[] };
  claims: Record<string, ClaimView>;
}

/**
 * The page as it will be once its pending changesets are applied (main DB,
 * before approval): claims, citations and excerpts rebuilt from their ops,
 * whose ids are assigned at proposal time.
 */
async function pendingView(ids: string[]): Promise<PageView> {
  type Op = Record<string, unknown> & { op: string; id?: string };
  const claimsById: Record<string, ClaimView> = {};
  const quotes: Record<string, string | null> = {};
  let blocks: BlockInput[] = [];
  for (const id of ids) {
    const cs = await mcp.call<{ ops: Op[] }>("get_changeset", { id });
    for (const o of cs.ops) {
      if (o.op === "create_claim") claimsById[o.id!] = { id: o.id!, text: o.text as string, citations: [] };
      else if (o.op === "create_excerpt") quotes[o.id!] = (o.quote as string | undefined) ?? null;
      else if (o.op === "cite" && claimsById[o.claim as string])
        claimsById[o.claim as string]!.citations.push({ id: o.id!, stance: o.stance as string, note: (o.note as string | undefined) ?? null, excerpt: { id: o.excerpt as string, quote: quotes[o.excerpt as string] ?? null } });
      else if (o.op === "uncite") for (const c of Object.values(claimsById)) c.citations = c.citations.filter((x) => x.id !== o.citation);
      else if (o.op === "update_claim" && claimsById[o.claim as string] && (o.set as { text?: string }).text) claimsById[o.claim as string]!.text = (o.set as { text: string }).text;
      else if (o.op === "create_page" && o.slug === "gupta-empire") blocks = o.blocks as BlockInput[];
    }
  }
  return { page: { version: 1, blocks }, claims: claimsById };
}

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  // One correction: once proposed or applied, running again must do nothing (later fixes own these claims).
  const done = flags.force ? null : await alreadyProposedOrApplied(mcp, TITLE);
  if (done) {
    console.log(done === "proposed" ? "A changeset with this title is already waiting for review. Nothing to do." : "This fix is already applied. Nothing to do.");
    process.exit(0);
  }
  const list = await mcp.call<{ id: string; title: string }[]>("list_changesets", { status: ["proposed", "applied"], limit: 200 });
  const dependsOn = DEPENDS.map((t) => {
    const c = list.find((x) => x.title === t);
    if (!c) throw new Error(`no changeset “${t}”`);
    return c.id;
  });

  const snap = {} as Record<Key, string>;
  for (const [k, origin] of Object.entries(CAPTURES) as [Key, (typeof CAPTURES)[Key]][])
    snap[k] = (await mcp.call<{ id: string }>("capture_snapshot", { origin })).id;

  const view = await mcp
    .call<PageView>("get_page", { page: "gupta-empire", format: "json" })
    .catch(async () => pendingView(dependsOn));
  const claims = Object.values(view.claims).filter((c, i, a) => a.findIndex((d) => d.id === c.id) === i);
  const claim = (key: string) => {
    const starts = claims.filter((c) => c.text.startsWith(key));
    const hits = starts.length ? starts : claims.filter((c) => c.text.includes(key));
    if (hits.length !== 1) throw new Error(`claim “${key}”: ${hits.length} matches`);
    return hits[0]!;
  };

  const ops: ChangeOpInput[] = [];
  const log: string[] = [];
  /** Rewords part of a claim's current text; skips if already done. Several rewords of one claim share one op. */
  const reword = (key: string, from: string, to: string) => {
    const c = claim(key);
    const prior = ops.find((o): o is Extract<ChangeOpInput, { op: "update_claim" }> => o.op === "update_claim" && o.claim === c.id && o.set.text !== undefined);
    const text = prior?.set.text ?? c.text;
    if (text.includes(to) && !text.includes(from)) return;
    if (!text.includes(from)) throw new Error(`claim “${key}” no longer contains “${from}”`);
    if (prior) prior.set.text = text.replace(from, to);
    else ops.push({ op: "update_claim", claim: c.id, set: { text: text.replace(from, to) } });
    log.push(`reword: ${key}`);
  };
  /** Changes a citation's stance (uncite, then cite again with the new stance and note). */
  const restance = (key: string, quotePrefix: string, stance: "supports" | "qualifies" | "contradicts" | "mentions", note?: string) => {
    const c = claim(key);
    const cit = c.citations.find((x) => x.excerpt.quote?.startsWith(quotePrefix));
    if (!cit) throw new Error(`claim “${key}”: no citation of “${quotePrefix}”`);
    if (cit.stance === stance && (note === undefined || cit.note === note)) return;
    ops.push({ op: "uncite", citation: cit.id });
    ops.push({ op: "cite", claim: c.id, excerpt: cit.excerpt.id, stance, ...((note ?? cit.note) ? { note: note ?? cit.note! } : {}) });
    log.push(`stance ${cit.stance} → ${stance}: ${key} / ${quotePrefix.slice(0, 40)}`);
  };
  const uncite = (key: string, quote: string) => {
    const c = claim(key);
    const cit = c.citations.find((x) => x.excerpt.quote === quote);
    if (!cit) return;
    ops.push({ op: "uncite", citation: cit.id });
    log.push(`uncite: ${key} / ${quote.slice(0, 40)}`);
  };
  type Loc = { page?: string; chapter?: string; section?: string; line?: string; label?: string };
  /** Adds an excerpt (new, from a snapshot) and cites it, unless the claim already cites that quote or a longer one containing it. */
  const add = (key: string, ref: string, source: string, k: Key, quote: string, locator: Loc, stance: "supports" | "qualifies" | "contradicts" | "mentions" = "supports", note?: string, citeNote?: string) => {
    const c = claim(key);
    if (c.citations.some((x) => x.excerpt.quote?.includes(quote))) return;
    if (!ops.some((o) => o.op === "create_excerpt" && (o as { ref?: string }).ref === ref))
      ops.push({ op: "create_excerpt", ref, source, snapshotId: snap[k], quote, locator, ...(note ? { note } : {}) } as ChangeOpInput);
    ops.push({ op: "cite", claim: c.id, excerpt: `@${ref}`, stance, ...(citeNote ? { note: citeNote } : {}) });
    log.push(`add ${ref} → ${key}`);
  };
  /** Cites an excerpt that already exists (by ref from an earlier changeset). */
  const citeRef = (key: string, ref: string, stance: "supports" | "qualifies" | "contradicts" | "mentions", quote: string, note?: string) => {
    const c = claim(key);
    if (c.citations.some((x) => x.excerpt.quote === quote)) return;
    ops.push({ op: "cite", claim: c.id, excerpt: `@${ref}`, stance, ...(note ? { note } : {}) });
    log.push(`cite ${ref} → ${key}`);
  };
  const F = (no: number | null, page: string, label: string, line?: string): Loc => ({ page, ...(line ? { line } : {}), label: no ? `No. ${no}, ${label}` : label });

  // Āryabhaṭa: Clark's 499 depends on the Kali Yuga epoch.
  reword("Āryabhaṭa wrote that he was 23", "His translator W. E. Clark worked this out as 499 CE", "His translator W. E. Clark, taking the Kali Yuga to begin in 3102 BCE as later astronomers did, worked this out as 499 CE");
  add("Āryabhaṭa wrote that he was 23", "x_clark_if", "@s_clark", "clark", "If Aryabhata began the Kaliyuga at 3102 b.c. as later astronomers did, and if his fourth yugapada", { page: "54", label: "Clark's note to Kālakriyāpāda 10" }, "supports", "Continues on p. 55: “began with the beginning of the Kaliyuga, we arrive at the date 499 a.d.”");
  // The Western Satraps: Saurashtra, and a tentative date.
  reword("Chandragupta II conquered the Western Satraps", "who had ruled Gujarat and Saurashtra for centuries", "who had ruled Saurashtra (Kathiawar) for centuries");
  reword("Chandragupta II conquered the Western Satraps", "a recent survey puts it between 397 and 409", "a recent survey tentatively dates it between 397 and 409");
  // Smith 1919.
  reword("In 1919 Smith", "In 1919 Smith stretched the golden age to 320–480 CE", "In 1919 Smith reckoned the golden age as 320–480 CE");
  // Cosmas.
  reword("In the sixth century", "the Greek merchant Cosmas wrote", "Cosmas, a former merchant probably from Alexandria, wrote");
  reword("In the sixth century", "went to war with two thousand elephants", "was said to go to war with two thousand elephants");
  add("In the sixth century", "x_cosmas_alexandria", "@s_cosmas", "cosmas", "He was most probably a native of Alexandria, and may have been of Greek parentage.", { page: "iv", label: "McCrindle's Introduction" });
  add("In the sixth century", "x_cosmas_merchant", "@s_cosmas", "cosmas", "His education was confined to the more elementary branches of knowledge, such as would fit him for the career he pursued in the earlier part of his life — that of a merchant.", { page: "iv", label: "McCrindle's Introduction" });
  add("In the sixth century", "x_cosmas_547", "@s_cosmas", "cosmas", "Cosmas must have been writing about the year 547.", { page: "x", label: "McCrindle's Introduction" });
  // Junāgaḍh: what the year 136 dates.
  add("On the same boulder at Junāgaḍh", "x_f_junagadh_136_full", "@s_fleet", "fleet", "The inscription then proceeds to its real object ; viz. to record that, “ making the calculation in the reckoning of the Guptas,” in the year one hundred and thirty-six (A.D. 455-56),", F(14, "57", "Junagadh rock inscription, introduction"), "supports", "Continues on p. 58 with the burst of the lake.");
  uncite("On the same boulder at Junāgaḍh", "in the year one hundred and thirty-six (A.D. 455-56)");
  add("On the same boulder at Junāgaḍh", "x_f_junagadh_burst_full", "@s_fleet", "fleet", "at night, on the sixth day of the month Praushthapada (August-September), the lake Sudarsana (formed in the valley round the foot of Girnar, by an ancient embankment across the gorge, near where the inscription is) burst in consequence of excessive rain.", F(14, "58", "Junagadh rock inscription, introduction"), "supports", "OCR “Sudar^ana”, “Gim4r”.");
  uncite("On the same boulder at Junāgaḍh", "burst in consequence of excessive rain");
  // Toramāṇa a Hūṇa; “a few years later” is Fleet's “shortly after”.
  citeRef("A few years later, “in the first year”", "x_f_huna_toramana", "supports", "And it was doubtless the death of Skandagupta, that enabled the Hunas, who had been repulsed by him, to assume the aggressive again, under the leadership of Toramana", "Fleet: Toramāṇa led the Hūṇas.");
  citeRef("A few years later, “in the first year”", "x_f_toramana_after", "supports", "The mention of Matrivishnu in this inscription as deceased, is of importance, as shewing that Toramana comes, so far as his possession of Eastern Malwa is concerned, shortly after Budhagupta", "“Shortly after” Budhagupta's inscription of 484–485.");
  add("A few years later, “in the first year”", "x_wp_alchon_toramana_huna", "@s_wp_alchon", "wpAlchon", "Toramana is also described as a Huna ( Hūṇā) in the Rīsthal inscription.", { section: "Name" });
  // Fleet's second point rests on Toramāṇa's coins.
  reword("From the two Eran inscriptions Fleet argued", "and that the Hūṇas, repulsed by Skandagupta, attacked again under his leadership.", "and, from the dates on Toramāṇa's coins, that the Hūṇas, repulsed by Skandagupta, attacked again under his leadership after Skandagupta's death.");
  add("From the two Eran inscriptions Fleet argued", "x_f_toramana_coins", "@s_fleet", "fleet", "If, then, the date on Toramana's coins is 52, and if we apply it as his regnal date, about which there need be felt no special difficulty", F(null, "12", "Introduction"), "supports", "OCR “Toram4na’s”. The sentence goes on to put the start of his reign near Skandagupta's latest date.");
  // Mandasor: the repair.
  add("The same inscription says that some of the weavers", "x_f_silk_repaired", "@s_fleet", "fleet", "And, in the course of a long time, under other kings, part of this temple fell into disrepair ; so now, in order to increase their own fame, the whole of this most noble house of the Sun has been repaired again by the munificent corporation", F(18, "87", "Mandasor inscription, translation", "19"));
  uncite("The same inscription says that some of the weavers", "And, in the course of a long time, under other kings, part of this temple fell into disrepair");
  // Ujjain.
  add("Kālidāsa's poems show he knew Ujjain", "x_ryder_ujjain_full", "@s_ryder", "ryder", "We know from Kalidasa's writings that he spent at least a part of his life in the city of Ujjain. He refers to Ujjain more than once, and in a manner hardly possible to one who did not know and love the city.", { page: "x", label: "Introduction" });
  uncite("Kālidāsa's poems show he knew Ujjain", "We know from Kalidasa's writings that he spent at least a part of his life in the city of Ujjain.");
  // Sanchi: the donor is “apparently” an officer.
  reword("At the Buddhist monastery of Sanchi", "an officer who said he lived by Chandragupta II's favour made a gift", "a donor who said he lived by Chandragupta II's favour, apparently one of his officers, made a gift");
  add("At the Buddhist monastery of Sanchi", "x_f_sanchi_officer", "@s_fleet", "fleet", "the son of Undana, and apparently an officer of Chandragupta II.", F(5, "30", "Sanchi inscription of Chandragupta II, year 93, introduction (page inferred)"), "supports", "Of the donor, Āmrakārdava.");
  // The Alchons.
  reword("The Hūṇas who invaded India around 500", "are now usually identified as the Alchon Huns", "are identified as the Alchon Huns");
  reword("The Hūṇas who invaded India around 500", "the Hephthalites, the “White Huns” of Bactria,", "the Hephthalites, whom Indians called “White Huns”,");
  add("The Hūṇas who invaded India around 500", "x_wp_alchon_500", "@s_wp_alchon", "wpAlchon", "As they invaded northern and central India circa 500 CE, the Alchon Huns issued several types of coinage", { section: "Coinage legacy" });
  add("The Hūṇas who invaded India around 500", "x_wp_alchon_huna", "@s_wp_alchon", "wpAlchon", "To contemporaneous observers in India, the Alchon were one of the Hūṇa peoples (or Hunas).", { section: "Name" });
  add("The Hūṇas who invaded India around 500", "x_wp_heph_white", "@s_wp_hephthalites", "wpHephthalites", "The Indians also used the expression \"White Huns\" (Sveta Huna) for the Hephthalites.", { section: "Name" });
  // Samudragupta: the choosing is Fleet's reading.
  reword("Samudragupta's inscription says his father", "says his father chose him, embracing him and exclaiming", "says his father embraced him, exclaiming");
  // Udayagiri: the gift itself.
  add("At Udayagiri near Vidiśā", "x_f_udaya_gift", "@s_fleet", "fleet", "In the year 80 (and) 2, on the eleventh lunar day of the bright fortnight of the month Ashddha, — this (is) the appropriate religious gift", F(3, "25", "Udayagiri cave inscription of the year 82, translation"), "supports", "OCR “Ashddha” for Āṣāḍha. The donor's titles follow.");
  // Kusumapura: Clark's bracket no longer carries “his work”.
  reword("the science which is honored at Kusumapura", "Āryabhaṭa says his work sets out “the science which is honored at Kusumapura”, usually taken to be Pāṭaliputra.", "Āryabhaṭa says he sets forth “the science which is honored at Kusumapura”, naming the school he belonged to; Kusumapura is identified with Pāṭaliputra.");
  add("the science which is honored at Kusumapura", "x_clark_school", "@s_clark", "clark", "At any rate, Aryabhata states the school to which he belongs.", { page: "21", label: "Clark's note to Gaṇitapāda 1" }, "supports", "The sentence before allows another reading: “here at Kusumapura the revered science”.");

  if (!ops.length) {
    console.log("Everything is already fixed. Nothing to do.");
    process.exit(0);
  }
  console.log(log.map((l) => `  ${l}`).join("\n"));
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "Fixes from the verifier's joint support checks of the Gupta Empire page (14 claims whose citations, taken together, still left a step unquoted).",
      "**Reworded claims:**",
      "- Āryabhaṭa: Clark's 499 assumes the Kali Yuga began in 3102 BCE.",
      "- Western Satraps: Saurashtra (Kathiawar), not Gujarat; the survey's date is “tentative”.",
      "- Smith 1919 “reckoned”, not “stretched”, the golden age.",
      "- Cosmas: a former merchant probably from Alexandria, not a “Greek merchant”; Gollas “was said to” go to war with 2,000 elephants.",
      "- Fleet's Hūṇa argument rests on Toramāṇa's coins.",
      "- Sanchi: the donor is “apparently” an officer.",
      "- Alchons: “identified as”, and the Hephthalites as those Indians called “White Huns”.",
      "- Samudragupta: the inscription says his father embraced him; the choosing is Fleet's reading.",
      "- Kusumapura: Āryabhaṭa “sets forth” the school's science; Clark's “[in this work]” no longer carries the claim.",
      "**New or extended excerpts:**",
      "- Clark's conditional;",
      "- Cosmas's origin, trade and date (c. 547);",
      "- Junāgaḍh: what the year 136 dates, and the full burst sentence;",
      "- Fleet and Wikipedia on Toramāṇa as a Hūṇa, and Fleet's “shortly after” Budhagupta;",
      "- Toramāṇa's coins;",
      "- the Mandasor repair;",
      "- Ryder on Ujjain;",
      "- the Sanchi officer;",
      "- the Alchons c. 500 and as Hūṇas;",
      "- the Udayagiri gift;",
      "- Clark on Āryabhaṭa's school.",
      "Depends on the page changeset, its sources follow-up and the first support-fix changeset.",
    ].join("\n"),
    dependsOn,
    ops,
  });
  summarize("gupta joint fixes", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
