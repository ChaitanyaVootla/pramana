import {
  applyPagePatch,
  extentYearsLabel,
  formatFuzzyDate,
  formatLocator,
  formatYear,
  diffBlocks,
  diffWords,
  shortCitation,
  toFuzzyDate,
  type Block,
  type ChangeOp,
} from "@pramana/core";
import type { ChangesetView } from "@pramana/services";
import Link from "next/link";
import { EvidenceSeal } from "@/components/evidence/EvidenceSeal";
import { MediaOpCard } from "@/components/media/MediaOpCard";
import { Badge } from "@/components/ui/badge";
import { ASSESSMENT_LABELS, KIND_LABELS, STANCE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { CheckLine, quoteCheck } from "./checks";
import { ClientMiniMap } from "./ClientMap";

/* ------------------------------------------------------------------ groups */

export type Op = ChangeOp & { id?: string };
type OpName = ChangeOp["op"];

/** Ops grouped for review, most consequential first. */
export const GROUPS: { key: string; ops: OpName[]; one: string; many: string; open: boolean }[] = [
  {
    key: "claims",
    ops: ["create_claim", "update_claim"],
    one: "claim",
    many: "claims",
    open: true,
  },
  {
    key: "pages",
    ops: ["create_page", "update_page", "patch_page"],
    one: "page",
    many: "pages",
    open: true,
  },
  {
    key: "borders",
    ops: ["create_extent", "update_extent"],
    one: "border",
    many: "borders",
    open: true,
  },
  {
    key: "media",
    ops: ["create_media", "update_media"],
    one: "picture",
    many: "pictures",
    open: true,
  },
  { key: "excerpts", ops: ["create_excerpt", "delete_excerpt"], one: "quotation", many: "quotations", open: false },
  {
    key: "sources",
    ops: ["create_source", "update_source"],
    one: "source",
    many: "sources",
    open: false,
  },
  {
    key: "entities",
    ops: ["create_entity", "update_entity", "link_entities"],
    one: "person, place or link",
    many: "people, places and links",
    open: false,
  },
  {
    key: "citations",
    ops: ["cite", "uncite", "relate_claims"],
    one: "citation or relation",
    many: "citations and relations",
    open: false,
  },
];

export function groupCounts(ops: { op: string }[]): string {
  return GROUPS.map((g) => {
    const n = ops.filter((o) => (g.ops as string[]).includes(o.op)).length;
    return n ? `${n.toLocaleString("en-GB")} ${n === 1 ? g.one : g.many}` : null;
  })
    .filter(Boolean)
    .join(", ");
}

/* ------------------------------------------------------------------ status */

const STATUS: Record<string, { label: string; className: string }> = {
  proposed: { label: "Waiting for review", className: "bg-indigo-wash text-indigo" },
  applied: { label: "Approved", className: "bg-sage-wash text-sage" },
  rejected: { label: "Rejected", className: "bg-madder-wash text-madder" },
  withdrawn: { label: "Withdrawn", className: "bg-rule-soft text-ink-2" },
  failed: { label: "Could not apply", className: "bg-madder-wash text-madder" },
};

export function StatusBadge({
  status,
  delegated = false,
  className,
}: {
  status: string;
  delegated?: boolean;
  className?: string;
}) {
  // Approved by an agent under the user's standing instruction: said so, in neutral, never in the sage that
  // marks a person's own decision (docs/visual.md: green is for people).
  const s =
    status === "applied" && delegated
      ? { label: "Approved for you", className: "bg-rule-soft text-ink-2" }
      : (STATUS[status] ?? { label: status, className: "bg-rule-soft text-ink-2" });
  return (
    <Badge
      className={cn("h-5 rounded-sm px-1.5 font-sans text-xs font-medium", s.className, className)}
    >
      {s.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ names for refs */

export type EntityName = { label: string; slug?: string; existing: boolean };
export type EntityNames = Map<string, EntityName>;

/** Resolve an entity reference (id, slug, "@ref") to a name, from proposals or the site. */
export function nameOf(
  names: EntityNames,
  ref: string | undefined | null,
  refs?: Record<string, string>,
): EntityName | null {
  if (!ref) return null;
  const key = ref.replace(/^@/, "");
  return names.get(key) ?? (refs?.[key] ? (names.get(refs[key]!) ?? null) : null);
}

export function EntityRefText({
  names,
  value,
  refs,
}: {
  names: EntityNames;
  value: string | undefined | null;
  refs?: Record<string, string>;
}) {
  const n = nameOf(names, value, refs);
  if (!n)
    return (
      <span className="text-ink-3">
        {value ? `an unnamed entity (${value.slice(-8)})` : "nothing"}
      </span>
    );
  return n.existing && n.slug ? (
    <Link
      href={`/e/${n.slug}`}
      className="text-ink underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo"
    >
      {n.label}
    </Link>
  ) : (
    <span className="text-ink">{n.label}</span>
  );
}

/* ------------------------------------------------------------------ one op */

function safeDate(input: unknown): string | null {
  try {
    return input ? formatFuzzyDate(toFuzzyDate(input as never)) : null;
  } catch {
    return null;
  }
}

const HEAD = "font-sans text-sm text-ink-3";
const BODY = "mt-0.5 text-base text-ink";
const NOTE = "mt-1 font-sans text-ui text-ink-2";

const LINK_WORDS: Record<string, string> = {
  part_of: "is part of",
  located_in: "is in",
  ruled: "ruled",
  member_of: "is a member of",
  successor_of: "came after",
  predecessor_of: "came before",
  participant_in: "took part in",
  author_of: "wrote",
  contemporary_of: "lived at the same time as",
  related_to: "is related to",
};

const SPAN_WORDS: Record<string, string> = {
  life: "life",
  reign: "reign",
  floruit: "active",
  existence: "existed",
  construction: "made",
  activity: "took place",
};

function fieldList(set: Record<string, unknown>): string {
  return Object.keys(set)
    .map((k) => k.replace(/([A-Z])/g, " $1").toLowerCase())
    .join(", ");
}

/** What a page setting (a spec key) is, in a reviewer's words. */
function specWords(path: string): string {
  const words: Record<string, string> = {
    "hero.media": "lead image",
    "hero.panels": "panels beside the title",
    hero: "title area",
    "rail.panels": "panels beside the text",
    rail: "panels beside the text",
    atlas: "map",
    timeline: "timeline",
    outline: "contents list",
  };
  return words[path] ?? words[path.split(".")[0]!] ?? path;
}

/** A readable description of one op, for a reviewer who should not have to read JSON. */
export function OpView({ op, cs, names }: { op: Op; cs: ChangesetView; names: EntityNames }) {
  const check = op.id ? cs.report.excerptChecks?.find((c) => c.excerptId === op.id) : undefined;
  const claimReport = op.id ? cs.report.claims?.find((c) => c.claimId === op.id) : undefined;
  switch (op.op) {
    case "create_claim": {
      const when = safeDate(op.when);
      return (
        <>
          <p className={HEAD}>
            New {(KIND_LABELS[op.kind] ?? op.kind).toLowerCase()}
            {op.assessment && op.assessment !== "unassessed"
              ? `, ${ASSESSMENT_LABELS[op.assessment]?.toLowerCase()}`
              : ""}
            {when && <span className="tnum">, {when}</span>}
          </p>
          <p className={BODY}>{op.text}</p>
          {op.assessmentNote && <p className={NOTE}>{op.assessmentNote}</p>}
          {claimReport && (
            <p className="mt-2 flex items-center gap-2 font-sans text-ui text-ink-2">
              <EvidenceSeal level={claimReport.level} />
              {claimReport.issues.length > 0 && (
                <span
                  className={
                    claimReport.issues.some((i) => i.severity === "warning")
                      ? "text-turmeric-ink"
                      : undefined
                  }
                >
                  {claimReport.issues.map((i) => i.message).join(" ")}
                </span>
              )}
            </p>
          )}
        </>
      );
    }
    case "update_claim":
      return (
        <>
          <p className={HEAD}>
            Edit to a{" "}
            <Link href={`/c/${op.claim}`} className="underline underline-offset-3 hover:text-ink">
              claim
            </Link>
            : {fieldList(op.set)}
          </p>
          {op.set.text && <p className={BODY}>{op.set.text}</p>}
        </>
      );
    case "create_excerpt": {
      const q = check ? quoteCheck(check.status, check.score) : null;
      return (
        <>
          <p className={HEAD}>{op.locator ? formatLocator(op.locator) : "Quotation"}</p>
          {op.quote ? (
            <blockquote className="mt-1 border-l-2 border-indigo pl-3 text-base text-ink">
              “{op.quote}”
            </blockquote>
          ) : (
            <p className={BODY}>No quotation; cited by location only.</p>
          )}
          {q && (
            <CheckLine state={q.state} className="mt-1.5">
              {q.text}
            </CheckLine>
          )}
          {check?.matchedText && check.status === "fuzzy" && (
            <p className="mt-1 pl-5 font-sans text-sm text-ink-3">
              The stored copy reads:{" "}
              <span className="font-serif text-ink-2">“{check.matchedText}”</span>
            </p>
          )}
        </>
      );
    }
    case "create_source":
      return (
        <>
          <p className={HEAD}>
            New source:{" "}
            {op.tier === "primary"
              ? "primary"
              : op.tier === "secondary"
                ? "scholarship"
                : "reference work"}
            , {op.kind.replace(/_/g, " ")}
          </p>
          <p className={BODY}>
            {shortCitation(op.csl)}: <em>{op.csl.title}</em>
          </p>
          {op.license && (
            <p className={NOTE}>
              Licence: {op.license.status.replace(/_/g, " ")}
              {op.license.note ? `. ${op.license.note}` : ""}
            </p>
          )}
        </>
      );
    case "update_source":
      return <p className={HEAD}>Edit to a source: {fieldList(op.set)}</p>;
    case "create_entity": {
      const when = safeDate(op.when);
      return (
        <>
          <p className={HEAD}>New {op.kind}</p>
          <p className={BODY}>
            {op.label}
            {when && <span className="ml-2 font-sans text-ui text-ink-2 tnum">{when}</span>}
          </p>
          {op.description && <p className={NOTE}>{op.description}</p>}
          {op.spans && op.spans.length > 0 && (
            <p className="mt-1 font-sans text-sm text-ink-3 tnum">
              {op.spans.map((s, i) => (
                <span key={i}>
                  {i > 0 && "; "}
                  {SPAN_WORDS[s.role] ?? s.role} {safeDate(s.when) ?? "?"}
                </span>
              ))}
            </p>
          )}
        </>
      );
    }
    case "update_entity":
      return (
        <>
          <p className={HEAD}>
            Edit to <EntityRefText names={names} value={op.entity} refs={cs.refs} />:{" "}
            {fieldList(op.set)}
          </p>
          {op.set.description && <p className={NOTE}>{op.set.description}</p>}
        </>
      );
    case "link_entities":
      return (
        <p className="font-sans text-ui text-ink-2">
          <EntityRefText names={names} value={op.from} refs={cs.refs} />{" "}
          {LINK_WORDS[op.type] ?? op.type.replace(/_/g, " ")}{" "}
          <EntityRefText names={names} value={op.to} refs={cs.refs} />
          {op.note && <span className="text-ink-3">. {op.note}</span>}
        </p>
      );
    case "cite":
      return (
        <p className="font-sans text-ui text-ink-2">
          A quotation is cited as {STANCE_LABELS[op.stance]?.toLowerCase() ?? op.stance} a claim
          {op.note && <span className="text-ink-3">. {op.note}</span>}
        </p>
      );
    case "uncite":
      return <p className="font-sans text-ui text-ink-2">A citation is removed</p>;
    case "delete_excerpt":
      return (
        <p className="font-sans text-ui text-ink-2">
          An unused quotation is removed ({op.excerpt.slice(-8)})
          {op.reason && <span className="text-ink-3">: {op.reason}</span>}
        </p>
      );
    case "relate_claims":
      return (
        <p className="font-sans text-ui text-ink-2">
          Two claims are linked: one {op.type.replace(/_/g, " ")} the other
          {op.note && <span className="text-ink-3">. {op.note}</span>}
        </p>
      );
    case "create_page":
      return (
        <>
          <p className={HEAD}>
            New {op.kind} page at /p/{op.slug}, {op.blocks.length} blocks
          </p>
          <p className={BODY}>{op.title}</p>
          {op.summary && <p className={NOTE}>{op.summary}</p>}
        </>
      );
    case "update_page":
      return (
        <p className={HEAD}>
          Edit to page {op.page}: {fieldList(op.set)}
        </p>
      );
    case "patch_page":
      return (
        <p className={HEAD}>
          Edit to some blocks of page {op.page}:{" "}
          {[
            op.replace?.length && `${op.replace.length} changed`,
            op.insert?.length && `${op.insert.length} added`,
            op.remove?.length && `${op.remove.length} removed`,
            op.move?.length && `${op.move.length} moved`,
            op.spec?.length && op.spec.map((e) => specWords(e.path)).join(", "),
          ]
            .filter(Boolean)
            .join(", ") || "nothing"}
        </p>
      );
    case "create_media":
      return <MediaOpCard op={op} />;
    case "update_media":
      return (
        <p className={HEAD}>
          Edit to picture {op.media.slice(-8)}: {fieldList(op.set)}
        </p>
      );
    default:
      return <p className={HEAD}>{(op as { op: string }).op.replace(/_/g, " ")}</p>;
  }
}

/* ------------------------------------------------------------------ borders */

type ExtentOp = Extract<ChangeOp, { op: "create_extent" }> & { id?: string };
type ExtentEdit = Extract<ChangeOp, { op: "update_extent" }> & { id?: string };

function positions(geometry: { coordinates: number[][][][] } | undefined): number {
  if (!geometry) return 0;
  return geometry.coordinates.reduce((a, p) => a + p.reduce((b, r) => b + r.length, 0), 0);
}

const AREA = new Intl.NumberFormat("en-GB", { maximumSignificantDigits: 3, notation: "compact" });

/** The year in which the most of these extents are in force, for a single-year map preview. */
function busiestYear(extents: ExtentOp[]): number | null {
  let best: { year: number; n: number } | null = null;
  for (const c of new Set(extents.map((e) => e.fromYear))) {
    const n = extents.filter((e) => e.fromYear <= c && c <= e.toYear).length;
    if (!best || n > best.n) best = { year: c, n };
  }
  return best?.year ?? null;
}

/**
 * Borders (historical extents) summarised for review: a small map of the
 * borders in force in one year, then one row per extent. Geometry is never
 * printed; only a handful of shapes go to the map.
 */
export function BordersGroup({
  ops,
  names,
  refs,
}: {
  ops: (ExtentOp | ExtentEdit)[];
  names: EntityNames;
  refs?: Record<string, string>;
}) {
  const created = ops.filter((o): o is ExtentOp => o.op === "create_extent");
  const edits = ops.filter((o): o is ExtentEdit => o.op === "update_extent");
  const year = busiestYear(created);
  const inForce =
    year === null ? [] : created.filter((e) => e.fromYear <= year && year <= e.toYear);
  const preview = [...inForce]
    .sort((a, b) => (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0))
    .slice(0, 8)
    .map((e, i) => ({ id: e.id ?? `${e.name}-${i}`, name: e.name, geometry: e.geometry }));
  const datasets = [...new Set(created.map((e) => e.dataset))];
  const polities = new Set(created.map((e) => e.entity ?? e.name)).size;
  const lo = created.length ? Math.min(...created.map((e) => e.fromYear)) : null;
  const hi = created.length ? Math.max(...created.map((e) => e.toYear)) : null;
  const totalPositions = created.reduce((n, e) => n + positions(e.geometry), 0);
  const sorted = [...created].sort(
    (a, b) => a.fromYear - b.fromYear || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-5">
      {created.length > 0 && (
        <p className="font-sans text-note text-ink-2">
          {created.length.toLocaleString("en-GB")} {created.length === 1 ? "border" : "borders"} for{" "}
          {polities} {polities === 1 ? "state" : "states"}
          {lo !== null && hi !== null && (
            <span className="tnum">, spanning {extentYearsLabel(lo, hi)}</span>
          )}
          , taken from {datasets.join(" and ")}.{" "}
          <span className="text-ink-3">
            Each is a reconstruction drawn at map scale, not a surveyed line.{" "}
            {totalPositions.toLocaleString("en-GB")} points of outline in all.
          </span>
        </p>
      )}

      {preview.length > 0 && year !== null && (
        <figure>
          <div className="h-[260px] overflow-hidden rounded-md border border-rule">
            <ClientMiniMap features={[]} extents={preview} height={260} />
          </div>
          <figcaption className="mt-2 font-sans text-sm text-ink-3">
            The borders in force in <span className="tnum">{formatYear(year)}</span>
            {inForce.length > preview.length
              ? `, the ${preview.length} largest of ${inForce.length}`
              : ""}
            {created[0]?.attribution ? `; ${created[0].attribution}.` : "."}
          </figcaption>
        </figure>
      )}

      {sorted.length > 0 && (
        <div className="max-h-[30rem] overflow-auto rounded-md border border-rule">
          <table className="w-full font-sans text-sm tnum sm:text-ui">
            <thead className="sticky top-0 bg-paper text-left text-ink-2 shadow-[0_1px_0_var(--rule)]">
              <tr>
                <th className="px-2 py-2 sm:px-3 font-medium">Name in the dataset</th>
                <th className="px-2 py-2 sm:px-3 font-medium">Years</th>
                <th className="hidden px-2 py-2 sm:px-3 font-medium sm:table-cell">Belongs to</th>
                <th className="px-2 py-2 sm:px-3 text-right font-medium whitespace-nowrap">
                  Area, km<sup>2</sup>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => (
                <tr key={e.id ?? i} className="border-t border-rule-soft align-top">
                  <td className="px-2 py-1.5 sm:px-3 text-ink">
                    {e.name}
                    {e.certainty && e.certainty !== "reconstruction" && (
                      <span className="ml-1.5 text-sm text-turmeric-ink">{e.certainty}</span>
                    )}
                    {e.entity && nameOf(names, e.entity, refs)?.label !== e.name && (
                      <span className="block text-sm text-ink-3 sm:hidden">
                        <EntityRefText names={names} value={e.entity} refs={refs} />
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 sm:px-3 whitespace-nowrap text-ink-2">
                    {extentYearsLabel(e.fromYear, e.toYear)}
                  </td>
                  <td className="hidden px-2 py-1.5 sm:px-3 sm:table-cell">
                    {e.entity ? (
                      <EntityRefText names={names} value={e.entity} refs={refs} />
                    ) : (
                      <span className="text-ink-3">not linked</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 sm:px-3 text-right text-ink-2">
                    {e.areaKm2 != null ? AREA.format(e.areaKm2) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edits.length > 0 && (
        <ul className="space-y-1 font-sans text-ui text-ink-2">
          {edits.map((e, i) => (
            <li key={i}>
              Edit to border {e.set.name ?? e.extent.slice(-8)}:{" "}
              {fieldList(e.set as Record<string, unknown>)}
              {e.set.fromYear !== undefined && e.set.toYear !== undefined && (
                <span className="tnum">, now {extentYearsLabel(e.set.fromYear, e.set.toYear)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ JSON, safely */

/** The ops as JSON with geometry replaced by a count, so a 400 KB proposal stays readable. */
export function opsJson(ops: Op[], limit = 60_000): string {
  const slim = ops.map((o) => {
    if (
      (o.op === "create_extent" || o.op === "update_extent") &&
      "geometry" in (o.op === "create_extent" ? o : o.set)
    ) {
      const g = o.op === "create_extent" ? o.geometry : o.set.geometry;
      const summary = g
        ? `[${g.coordinates.length} polygons, ${positions(g)} positions; omitted here]`
        : undefined;
      return o.op === "create_extent"
        ? { ...o, geometry: { type: g?.type, coordinates: summary } }
        : { ...o, set: { ...o.set, geometry: { type: g?.type, coordinates: summary } } };
    }
    return o;
  });
  const text = JSON.stringify(slim, null, 2);
  return text.length > limit
    ? `${text.slice(0, limit)}\n\n… ${(text.length - limit).toLocaleString("en-GB")} more characters not shown.`
    : text;
}

/* ------------------------------------------------------------------ page edits */

const BLOCK_WORDS: Record<string, string> = {
  prose: "Prose",
  heading: "Heading",
  chapter: "Part heading",
  callout: "Note",
  claims: "Claim list",
  key_facts: "Key facts",
  misconception: "Often said",
  debate: "Debate",
  quote: "Quotation",
  figure: "Picture",
  gallery: "Pictures",
  guess: "Guess first",
  check: "Check yourself",
  already_know: "Names you'll meet",
  meanwhile: "Meanwhile",
  entities: "List of entries",
  viz: "Chart or map",
};

/** Markdown with link targets dropped, so a diff shows the words a reader sees. */
function readable(md: string): string {
  return md.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
}

/** The words of a block that a reader would see changed, as one string per comparable field. */
function blockText(b: Block): Record<string, string> {
  switch (b.type) {
    case "prose":
    case "callout":
      return { text: readable(b.markdown) };
    case "heading":
      return { text: b.text };
    case "chapter":
      return {
        title: b.title,
        promise: b.promise ?? "",
        "what happened": b.brief ? readable(b.brief.happened) : "",
        "how we know": b.brief ? readable(b.brief.howWeKnow) : "",
      };
    case "guess":
      return { question: b.question, note: b.note ? readable(b.note) : "" };
    default:
      return {};
  }
}

/**
 * Groups a word diff into readable runs: a space between two changes joins
 * them, and each run of changes reads as the old words struck out, then the
 * new ones. Mostly rewritten text is shown whole, before and after.
 */
function diffRuns(before: string, after: string) {
  const parts = diffWords(before, after);
  const runs: (
    { kind: "same"; text: string } | { kind: "change"; removed: string; added: string }
  )[] = [];
  parts.forEach((p, i) => {
    const prev = runs[runs.length - 1];
    const next = parts[i + 1];
    const bridge =
      p.kind === "same" &&
      /^\s+$/.test(p.text) &&
      prev?.kind === "change" &&
      next &&
      next.kind !== "same";
    if (p.kind === "same" && !bridge) return runs.push({ kind: "same", text: p.text });
    const run =
      prev?.kind === "change"
        ? prev
        : (runs[runs.push({ kind: "change", removed: "", added: "" }) - 1] as {
            kind: "change";
            removed: string;
            added: string;
          });
    if (bridge || p.kind === "removed") run.removed += p.text;
    if (bridge || p.kind === "added") run.added += p.text;
  });
  const same = runs.reduce((n, r) => n + (r.kind === "same" ? r.text.length : 0), 0);
  return { runs, mostlyRewritten: same < Math.max(before.length, after.length) * 0.5 };
}

function WordsDiff({ before, after }: { before: string; after: string }) {
  const { runs, mostlyRewritten } = diffRuns(before, after);
  if (mostlyRewritten && before && after)
    return (
      <div className="mt-1 grid max-w-[66ch] gap-2">
        <p className="rounded-md bg-madder-wash/60 px-3 py-2 text-base leading-relaxed text-ink-2">
          <span className="mr-1.5 font-sans text-xs font-medium text-madder">Before</span>
          {before}
        </p>
        <p className="rounded-md bg-sage-wash/60 px-3 py-2 text-base leading-relaxed text-ink">
          <span className="mr-1.5 font-sans text-xs font-medium text-[#23703f] dark:text-sage">
            After
          </span>
          {after}
        </p>
      </div>
    );
  return (
    <p className="mt-1 max-w-[66ch] text-base leading-relaxed text-ink">
      {runs.map((r, i) =>
        r.kind === "same" ? (
          <span key={i}>{r.text}</span>
        ) : (
          <span key={i}>
            {r.removed.trim() && (
              <del className="rounded-[2px] bg-madder-wash px-0.5 text-ink-2 line-through decoration-madder/70">
                {r.removed.trim()}
              </del>
            )}
            {r.removed.trim() && r.added.trim() && " "}
            {r.added.trim() && (
              <ins className="rounded-[2px] bg-sage-wash px-0.5 text-ink no-underline">
                {r.added.trim()}
              </ins>
            )}
            {/\s$/.test(r.added || r.removed) ? " " : ""}
          </span>
        ),
      )}
    </p>
  );
}

function idsChange(before: string[], after: string[]): string | null {
  const added = after.filter((x) => !before.includes(x)).length;
  const removed = before.filter((x) => !after.includes(x)).length;
  const reordered = !added && !removed && before.join() !== after.join();
  const parts = [
    added && `${added} claim${added === 1 ? "" : "s"} added`,
    removed && `${removed} removed`,
    reordered && "reordered",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * An edit to a page, compared with the page as it is now: which blocks are
 * added, removed, changed or moved, and for prose the words before and after
 * (struck out and added). Other fields (title, summary, spec) are listed.
 */
export function PageEditDiff({
  op,
  current,
}: {
  op: Extract<ChangeOp, { op: "update_page" | "patch_page" }>;
  current: {
    title: string;
    summary: string | null;
    blocks: Block[];
    version: number;
    spec?: Record<string, unknown>;
  } | null;
}) {
  // A block-level patch is shown as the page it would make from the page as it is now.
  const patch =
    op.op === "patch_page" && current
      ? applyPagePatch(
          { blocks: current.blocks, spec: current.spec ?? {} },
          current.spec ? op : { ...op, spec: undefined },
        )
      : null;
  const set: Extract<ChangeOp, { op: "update_page" }>["set"] =
    op.op === "update_page" ? op.set : patch?.blocksChanged ? { blocks: patch.blocks } : {};
  const other =
    op.op === "update_page"
      ? fieldList(
          Object.fromEntries(
            Object.keys(set)
              .filter((k) => k !== "blocks")
              .map((k) => [k, 1]),
          ),
        )
      : (op.spec ?? []).map((e) => specWords(e.path)).join(", ");
  if (!current)
    return (
      <p className={HEAD}>
        Edit to page {op.page}: {op.op === "update_page" ? fieldList(set) : "some blocks"}. The page
        could not be loaded to compare.
      </p>
    );
  const changes = set.blocks ? diffBlocks(current.blocks, set.blocks) : [];
  const stale =
    op.op === "update_page" && op.baseVersion !== undefined && op.baseVersion !== current.version;
  return (
    <div>
      <p className={HEAD}>
        Edit to the page <span className="text-ink">{current.title}</span>
        {set.blocks && (
          <>
            : {changes.length} {changes.length === 1 ? "block" : "blocks"} changed of{" "}
            {set.blocks.length}
          </>
        )}
        {other.length > 0 && <>; also {other}</>}
      </p>
      {stale && (
        <p className="mt-1 font-sans text-sm text-madder">
          The page has changed since this edit was written (version {current.version}, edit made
          against {op.op === "update_page" ? op.baseVersion : null}); applying it will fail.
        </p>
      )}
      {patch && patch.conflicts.length > 0 && (
        <p className="mt-1 font-sans text-sm text-madder">
          Parts of the page this edit touches have changed since it was written; applying it will
          fail: {patch.conflicts.join("; ")}.
        </p>
      )}
      {patch && !patch.changed.length && !patch.conflicts.length && (
        <p className="mt-1 font-sans text-sm text-ink-3">
          The page already has everything in this edit.
        </p>
      )}
      {set.title !== undefined && set.title !== current.title && (
        <div className="mt-2">
          <p className="font-sans text-xs font-medium text-ink-3">Title</p>
          <WordsDiff before={current.title} after={set.title} />
        </div>
      )}
      {set.summary !== undefined && set.summary !== current.summary && (
        <div className="mt-2">
          <p className="font-sans text-xs font-medium text-ink-3">Summary</p>
          <WordsDiff before={current.summary ?? ""} after={set.summary ?? ""} />
        </div>
      )}
      {changes.length > 0 && (
        <ol className="mt-3 space-y-3">
          {changes.slice(0, 60).map((c, i) => {
            const block = c.kind === "changed" ? c.after : c.block;
            const label = BLOCK_WORDS[block.type] ?? block.type;
            return (
              <li key={i} className="rounded-md border border-rule-soft px-3 py-2">
                <p className="font-sans text-xs font-medium text-ink-3">
                  <span
                    className={cn(
                      c.kind === "added" && "text-[#23703f] dark:text-sage",
                      c.kind === "removed" && "text-madder",
                      c.kind === "changed" && "text-indigo",
                    )}
                  >
                    {c.kind === "added"
                      ? "Added"
                      : c.kind === "removed"
                        ? "Removed"
                        : c.kind === "moved"
                          ? "Moved"
                          : "Changed"}
                  </span>{" "}
                  {label} <span className="font-normal">({block.id})</span>
                  {c.kind === "moved" && ` from position ${c.from + 1} to ${c.to + 1}`}
                </p>
                {c.kind === "changed" &&
                  (() => {
                    const a = blockText(c.before);
                    const b = blockText(c.after);
                    const fields = Object.keys(b).filter((k) => a[k] !== b[k]);
                    const claimsA = "claimIds" in c.before ? (c.before.claimIds as string[]) : [];
                    const claimsB = "claimIds" in c.after ? (c.after.claimIds as string[]) : [];
                    const ids = idsChange(claimsA, claimsB);
                    if (!fields.length && !ids)
                      return (
                        <p className="mt-1 font-sans text-sm text-ink-3">
                          Settings or references changed, not the words.
                        </p>
                      );
                    return (
                      <>
                        {fields.map((f) => (
                          <div key={f} className="mt-1">
                            {fields.length > 1 || f !== "text" ? (
                              <p className="font-sans text-xs text-ink-3">{f}</p>
                            ) : null}
                            <WordsDiff before={a[f] ?? ""} after={b[f] ?? ""} />
                          </div>
                        ))}
                        {ids && <p className="mt-1 font-sans text-sm text-ink-2">{ids}</p>}
                      </>
                    );
                  })()}
                {(c.kind === "added" || c.kind === "removed") && blockText(block).text && (
                  <p
                    className={cn(
                      "mt-1 line-clamp-4 max-w-[66ch] text-base",
                      c.kind === "removed" ? "text-ink-3 line-through" : "text-ink",
                    )}
                  >
                    {blockText(block).text}
                  </p>
                )}
              </li>
            );
          })}
          {changes.length > 60 && (
            <li className="font-sans text-sm text-ink-3">and {changes.length - 60} more</li>
          )}
        </ol>
      )}
    </div>
  );
}
