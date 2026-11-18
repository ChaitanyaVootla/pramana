/**
 * Finds "Guess first" questions whose answer the learner has already been
 * shown before reaching them: in the page's summary or lede, "You may already
 * know", "Meanwhile", the chapter's own title or promise, the descriptions of
 * the people, places and terms the chapter shows in its rail, earlier parts'
 * text, or the first-steps questions (Pāṭaliputra). Read-only.
 *
 *   DATABASE_URL=…/pramana_preview pnpm tsx scripts/learn-spoilers.ts [page-slug]
 */
import { formatGuessAnswer, markdownInBlock, type Block } from "@pramana/core";

const svc = await import("@pramana/services");
const { closeDb } = await import("@pramana/db");

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[“”"‘’'*_[\]()]/g, "")
    .replace(/\(claim:[^)]*\)|\(entity:[^)]*\)/g, "");

/** What gives the answer away: the right option or the number, without filler words. */
function needles(block: Extract<Block, { type: "guess" }>): string[] {
  const a = block.answer;
  if (a.kind === "number") {
    const plain = String(a.value);
    return [...new Set([plain, a.value.toLocaleString("en-GB")])];
  }
  if (a.kind === "year") return [String(a.year)];
  const option = fold(a.options[a.correct] ?? "")
    .replace(/^(the|a|an|by|in|at)\s+/, "")
    .replace(/[.,;:!?]+$/, "");
  return option.length >= 3 ? [option] : [];
}

const SPELLED = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

/** Whole-word match; a small number also matches its spelling ("seven"). */
function contains(text: string, needle: string): boolean {
  const hay = fold(text);
  const n = fold(needle);
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, "u").test(hay)) return true;
  const k = Number(n);
  return Number.isInteger(k) && k <= 20 && new RegExp(`\\b${SPELLED[k]}\\b`).test(hay);
}

const only = process.argv[2];
let found = 0;
try {
  const pages = (await svc.listPages({ kind: "era" })).filter((p) => !only || p.slug === only);
  const firstSteps = await svc.getEntityDetail(svc.FIRST_STEPS_PLACE).catch(() => null);
  const firstStepsText = firstSteps ? fold(`${firstSteps.entity.label} ${firstSteps.entity.description ?? ""}`) : "";
  for (const p of pages) {
    const view = await svc.getPageView(p.id);
    const blocks = view.page.blocks;
    const firstChapter = blocks.findIndex((b) => b.type === "chapter");
    const before: { where: string; text: string }[] = [
      { where: "page summary", text: view.page.summary ?? "" },
      ...blocks.slice(0, firstChapter < 0 ? blocks.length : firstChapter).flatMap((b) => markdownInBlock(b).map((text) => ({ where: `intro (${b.id})`, text }))),
      ...blocks.filter((b) => b.type === "meanwhile").flatMap((b) => (b.type === "meanwhile" ? b.items.map((i) => ({ where: "Meanwhile", text: i.label })) : [])),
      { where: "first steps", text: firstStepsText },
    ];
    let chapter: Extract<Block, { type: "chapter" }> | null = null;
    const earlier: { where: string; text: string }[] = [];
    for (const b of blocks) {
      if (b.type === "chapter") {
        if (chapter) for (const x of blocks.slice(blocks.indexOf(chapter) + 1, blocks.indexOf(b))) markdownInBlock(x).forEach((text) => earlier.push({ where: `earlier part ${chapter!.id}`, text }));
        chapter = b;
        continue;
      }
      if (b.type !== "guess" || !chapter) continue;
      const rail = [...chapter.places, ...chapter.people, ...chapter.terms]
        .map((ref) => view.entities[ref])
        .filter(Boolean)
        .map((e) => ({ where: `rail: ${e!.label}`, text: `${e!.label} ${e!.description ?? ""}` }));
      // The part's date chip sits right above its guess.
      const chip = chapter.when ? JSON.stringify(chapter.when).match(/"year":\d+/g)?.map((y) => y.slice(7)).join(" ") ?? "" : "";
      const own = [
        { where: "chapter title", text: `${chapter.title} ${chapter.promise ?? ""}` },
        { where: "date chip", text: chip },
      ];
      const hits = needles(b).flatMap((n) =>
        [...own, ...rail, ...before, ...earlier].filter((s) => contains(s.text, n)).map((s) => `${s.where} has “${n}”`),
      );
      if (hits.length) {
        found++;
        console.log(`/${p.slug} ${b.id}: “${b.question}” → ${formatGuessAnswer(b.answer)}\n  ${[...new Set(hits)].slice(0, 6).join("\n  ")}`);
      }
    }
  }
  console.log(found ? `\n${found} guesses may be given away.` : "No guess is given away before it is asked.");
} finally {
  closeDb();
}
