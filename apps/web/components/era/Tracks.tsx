"use client";

import type { Block } from "@pramana/core";
import type { ExcerptCard, PageView } from "@pramana/services";
import { ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";
import { EvidenceSeal } from "@/components/evidence/EvidenceSeal";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Segments } from "@/components/ui/segments";
import { claimTier } from "@/lib/era";
import { cn } from "@/lib/utils";
import { jumpTo } from "./Outline";

type TracksBlock = Extract<Block, { type: "tracks" }>;
type Cell = TracksBlock["cells"][number];

/** Height of one facet's row in the weave. */
const ROW = "1.75rem";
const COLS = "grid grid-cols-[minmax(0,6.25rem)_minmax(0,1fr)] gap-x-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-x-4";

/**
 * A subject followed through the ages (a `tracks` block: facets by ages).
 *
 * The whole grid is drawn once, small, as *the weave*: one row for each facet,
 * one column for each age, a mark where something is written (darker where
 * someone of the time is quoted, dashed where nothing is known). It is the
 * picker and the overview at once, and it shows the gaps honestly.
 *
 * Under it the reader reads one thread at a time, two ways:
 *   - one facet across the ages (the default): every age in order, top to
 *     bottom, so the change is read down the page;
 *   - one age whole: every facet of that age.
 * Every entry is a crossing of the two, and the reader can turn at any of
 * them: an age's name opens that age whole, a facet's name follows the facet.
 *
 * What is said stands on the page in the serif, its claims linked into the
 * evidence drawer; a quotation is a voice, cut into the page as a field.
 * Nothing here scrolls sideways, so it reads the same on a phone.
 */
export function Tracks({
  block: b,
  view,
  selected,
  onSelect,
}: {
  block: TracksBlock;
  view: PageView;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [mode, setMode] = useState<"facet" | "age">("facet");
  const [facet, setFacet] = useState(b.facets[0]!.key);
  const [age, setAge] = useState(b.ages[0]!.entity);
  // The entry a click on the weave pointed at: marked until the reader chooses something else.
  const [spot, setSpot] = useState<string | null>(null);

  const cells = useMemo(
    () => new Map(b.cells.map((c) => [`${c.facet}|${c.age}`, c])),
    [b.cells],
  );
  const ages = useMemo(
    () =>
      b.ages.map((a) => {
        const e = view.entities[a.entity];
        return {
          ref: a.entity,
          label: a.label ?? e?.label ?? a.entity,
          when: e?.whenLabel ?? null,
          href: e ? (e.pageSlug ? `/p/${e.pageSlug}` : `/e/${e.slug}`) : null,
          target: a.target ?? null,
        };
      }),
    [b.ages, view.entities],
  );
  const fi = Math.max(0, b.facets.findIndex((f) => f.key === facet));
  const ai = Math.max(0, ages.findIndex((a) => a.ref === age));
  const theFacet = b.facets[fi]!;
  const theAge = ages[ai]!;
  const rowId = (f: string, a: number) => `${b.id}--${f}--${a}`;

  const followFacet = useCallback((key: string) => {
    setMode("facet");
    setFacet(key);
    setSpot(null);
  }, []);
  const readAge = useCallback((ref: string) => {
    setMode("age");
    setAge(ref);
    setSpot(null);
  }, []);
  // A mark on the weave: follow its facet, and bring its age into view.
  const point = (key: string, index: number) => {
    const a = ages[index];
    if (!a) return;
    setMode("facet");
    setFacet(key);
    setAge(a.ref);
    setSpot(rowId(key, index));
    requestAnimationFrame(() =>
      document.getElementById(rowId(key, index))?.scrollIntoView({ block: "nearest" }),
    );
  };

  const written = (key: string) => ages.filter((a) => cells.has(`${key}|${a.ref}`)).length;
  // Under a part's heading the grid's title is a level lower than when it stands in the page's opening.
  const at = view.page.blocks.findIndex((x) => x.id === b.id);
  const inPart = view.page.blocks
    .slice(0, Math.max(0, at))
    .some((x) => x.type === "chapter" || (x.type === "heading" && x.level === 2));
  const H = inPart ? "h3" : "h2";
  const Sub = inPart ? "h4" : "h3";
  const title = b.title ?? "Across the ages";

  return (
    <section id={b.id} aria-labelledby={`${uid}-title`} className="scroll-mt-28">
      <H id={`${uid}-title`} className="text-2xl text-ink">
        {title}
      </H>
      {b.intro && (
        <Markdown className="mt-2 max-w-[66ch] font-sans text-note leading-snug text-ink-2">
          {b.intro}
        </Markdown>
      )}

      <Segments
        aria-label="How to read it"
        className="mt-5 max-w-md"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setSpot(null);
        }}
        options={[
          { value: "facet", label: "Follow one thread" },
          { value: "age", label: "Read one age" },
        ]}
      />

      {/* ------------------------------------------------------------ the weave */}
      <div className="field mt-3 px-3 pt-2 pb-3 font-sans sm:px-4">
        <div className={COLS}>
          <p className="self-end pb-1.5 text-xs text-ink-3">
            {mode === "facet" ? "Pick a thread" : "Pick an age"}
          </p>
          {/* The ages along the top: the line is time (docs/visual.md §1). Arrow keys step along it. */}
          <div className="min-w-0">
          <p aria-hidden className="flex justify-between gap-3 text-xs text-ink-3">
            <span className="truncate">{ages[0]!.label}</span>
            <span className="truncate text-right">{ages[ages.length - 1]!.label}</span>
          </p>
          <div
            role="group"
            aria-label="Ages, earliest first"
            className="grid"
            style={{ gridTemplateColumns: `repeat(${ages.length}, minmax(0, 1fr))` }}
            onKeyDown={(e) => {
              const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              const next = ages[ai + step];
              if (!step || !next) return;
              e.preventDefault();
              readAge(next.ref);
              requestAnimationFrame(() =>
                document.getElementById(`${uid}-age-${ai + step}`)?.focus(),
              );
            }}
          >
            {ages.map((a, i) => {
              const on = mode === "age" && i === ai;
              return (
                <button
                  key={a.ref}
                  id={`${uid}-age-${i}`}
                  type="button"
                  aria-pressed={on}
                  tabIndex={i === ai ? 0 : -1}
                  title={`${a.label}${a.when ? `, ${a.when}` : ""}`}
                  onClick={() => readAge(a.ref)}
                  className="group flex h-7 items-center px-px"
                >
                  <span className="sr-only">
                    {a.label}
                    {a.when ? `, ${a.when}` : ""}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "block w-full rounded-[1px] transition-colors",
                      on
                        ? "h-[9px] bg-indigo ring-1 ring-ink ring-offset-1 ring-offset-field"
                        : "h-[5px] bg-indigo/40 group-hover:bg-indigo",
                    )}
                  />
                </button>
              );
            })}
          </div>
          </div>
        </div>

        <div className={cn(COLS, "relative")}>
          {/* The chosen thread, lit from its name to its last age. */}
          {mode === "facet" && (
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-x-1.5 rounded-sm bg-paper ring-1 ring-rule"
              style={{ top: `calc(${fi} * ${ROW})`, height: ROW }}
            />
          )}
          <div
            role="group"
            aria-label="Threads"
            className="relative grid"
            style={{ gridAutoRows: ROW }}
          >
            {b.facets.map((f) => {
              const on = mode === "facet" && f.key === facet;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  title={f.description}
                  onClick={() => followFacet(f.key)}
                  className={cn(
                    "truncate rounded-sm text-left text-sm transition-colors",
                    on ? "font-medium text-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          {/* The marks: for the eye and the pointer. The same choices are the buttons beside and above. */}
          <div
            aria-hidden
            className="relative grid cursor-pointer"
            style={{
              gridTemplateColumns: `repeat(${ages.length}, minmax(0, 1fr))`,
              gridAutoRows: ROW,
            }}
            onClick={(e) => {
              const el = (e.target as HTMLElement).closest<HTMLElement>("[data-f]");
              if (el) point(el.dataset.f!, Number(el.dataset.a));
            }}
          >
            {mode === "age" && (
              <span
                className="pointer-events-none absolute -inset-y-0.5 rounded-sm bg-paper ring-1 ring-rule"
                style={{
                  left: `${(ai / ages.length) * 100}%`,
                  width: `${100 / ages.length}%`,
                }}
              />
            )}
            {b.facets.flatMap((f) =>
              ages.map((a, i) => {
                const c = cells.get(`${f.key}|${a.ref}`);
                return (
                  <span
                    key={`${f.key}|${a.ref}`}
                    data-f={f.key}
                    data-a={i}
                    title={`${f.label}, ${a.label}`}
                    className="group relative flex items-center justify-center"
                  >
                    <span
                      className={cn(
                        "block size-2 rounded-[2px] transition-transform group-hover:scale-150",
                        !c
                          ? "border border-dashed border-ink-3"
                          : c.excerptId
                            ? "bg-indigo"
                            : "bg-indigo/40",
                      )}
                    />
                  </span>
                );
              }),
            )}
          </div>
        </div>

        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="block size-2 rounded-[2px] bg-indigo/40" /> written
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="block size-2 rounded-[2px] bg-indigo" /> with words from the
            time
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="block size-2 rounded-[2px] border border-dashed border-ink-3"
            />{" "}
            nothing written yet
          </li>
        </ul>
      </div>

      {/* ------------------------------------------------------------ the thread being read */}
      {mode === "facet" ? (
        <div className="mt-8" aria-live="polite">
          <Sub className="text-xl text-ink">
            {theFacet.label}
            <span className="ml-3 font-sans text-sm text-ink-3 tnum">
              in {written(theFacet.key)} of {ages.length} ages
            </span>
          </Sub>
          {theFacet.description && (
            <p className="mt-1 max-w-[66ch] font-sans text-note text-ink-2">
              {theFacet.description}
            </p>
          )}
          <ol className="mt-4 border-t border-rule">
            {ages.map((a, i) => (
              <Entry
                key={a.ref}
                id={rowId(theFacet.key, i)}
                marked={spot === rowId(theFacet.key, i)}
                head={a.label}
                sub={a.when}
                turn={`Read ${a.label} whole`}
                onTurn={() => readAge(a.ref)}
                cell={cells.get(`${theFacet.key}|${a.ref}`)}
                view={view}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </ol>
        </div>
      ) : (
        <div className="mt-8" aria-live="polite">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Sub className="min-w-0 text-xl text-ink">
              {theAge.label}
              {theAge.when && (
                <span className="ml-3 font-sans text-sm text-ink-3 tnum">{theAge.when}</span>
              )}
            </Sub>
            <span className="ml-auto flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={ai === 0}
                onClick={() => ages[ai - 1] && readAge(ages[ai - 1]!.ref)}
                aria-label={ages[ai - 1] ? `The age before: ${ages[ai - 1]!.label}` : "No earlier age"}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={ai === ages.length - 1}
                onClick={() => ages[ai + 1] && readAge(ages[ai + 1]!.ref)}
                aria-label={ages[ai + 1] ? `The age after: ${ages[ai + 1]!.label}` : "No later age"}
              >
                <ChevronRight />
              </Button>
            </span>
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm">
            {theAge.target && (
              <a
                href={`#${theAge.target}`}
                onClick={(e) => jumpTo(theAge.target!, e)}
                className="inline-flex items-center gap-1 text-indigo no-underline hover:underline"
              >
                <ArrowDown className="size-3.5" aria-hidden /> This age on this page
              </a>
            )}
            {theAge.href && (
              <Link href={theAge.href} className="text-indigo no-underline hover:underline">
                The page about {theAge.label}
              </Link>
            )}
          </p>
          <ol className="mt-4 border-t border-rule">
            {b.facets.map((f) => (
              <Entry
                key={f.key}
                id={rowId(f.key, ai)}
                marked={false}
                head={f.label}
                sub={null}
                turn={`Follow ${f.label.toLowerCase()} through the ages`}
                onTurn={() => followFacet(f.key)}
                cell={cells.get(`${f.key}|${theAge.ref}`)}
                view={view}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/** Claims a cell rests on that its own sentences do not link: offered after the text. */
function unlinked(cell: Cell): string[] {
  const linked = new Set([...cell.text.matchAll(/\]\(claim:([^)\s]+)\)/g)].map((m) => m[1]));
  return cell.claimIds.filter((id) => !linked.has(id));
}

/** One crossing of a facet and an age: its name (which turns the reading the other way), what is said, and the voice. */
function Entry({
  id,
  marked,
  head,
  sub,
  turn,
  onTurn,
  cell,
  view,
  selected,
  onSelect,
}: {
  id: string;
  marked: boolean;
  head: string;
  sub: string | null;
  /** What pressing the name does ("Read Mughal Empire whole"). */
  turn: string;
  onTurn: () => void;
  cell: Cell | undefined;
  view: PageView;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const excerpt = cell?.excerptId ? view.excerpts[cell.excerptId] : undefined;
  const more = cell ? unlinked(cell) : [];
  return (
    <li
      id={id}
      aria-current={marked ? "true" : undefined}
      className={cn(
        "grid scroll-mt-28 gap-x-6 gap-y-1.5 border-b border-rule py-4 sm:grid-cols-[9.5rem_minmax(0,1fr)]",
        marked && "bg-indigo-wash shadow-[0_0_0_8px_var(--indigo-wash)]",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 sm:block">
        <button
          type="button"
          onClick={onTurn}
          title={turn}
          aria-label={`${head}. ${turn}`}
          className="rounded-sm text-left font-heading text-lg leading-snug text-ink hover:text-indigo hover:underline hover:underline-offset-3"
        >
          {head}
        </button>
        {sub && <p className="font-sans text-sm text-ink-3 tnum sm:mt-0.5">{sub}</p>}
      </div>
      <div className="min-w-0 max-w-[62ch]">
        {cell ? (
          <>
            <Markdown className="text-base leading-[1.62] text-ink">{cell.text}</Markdown>
            {more.length > 0 && (
              <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm">
                {more.map((cid, n) => {
                  const claim = view.claims[cid];
                  if (!claim) return null;
                  return (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => onSelect(cid)}
                      aria-pressed={selected === cid}
                      aria-label={`The evidence: ${claim.text}`}
                      title={claim.text}
                      className="inline-flex items-center gap-1.5 rounded-sm text-indigo hover:underline aria-pressed:underline"
                    >
                      <EvidenceSeal level={claim.level} tier={claimTier(claim)} />
                      {more.length > 1 ? `Evidence ${n + 1}` : "The evidence"}
                    </button>
                  );
                })}
              </p>
            )}
            {excerpt && <Voice excerpt={excerpt} />}
          </>
        ) : (
          <p className="font-sans text-sm text-ink-3">Nothing written here yet.</p>
        )}
      </div>
    </li>
  );
}

/** A first-hand quotation: someone of the time speaking, cut into the page. */
export function Voice({ excerpt: e }: { excerpt: ExcerptCard }) {
  if (!e.quote) return null;
  return (
    <figure className="field mt-3 border-l-2 border-indigo px-4 py-3">
      <blockquote className="font-serif text-base leading-[1.55] text-ink">{e.quote}</blockquote>
      <figcaption className="mt-2 font-sans text-sm text-ink-2">
        <Link
          href={`/s/${e.source.id}`}
          className="text-ink underline decoration-rule underline-offset-3 transition-colors hover:decoration-ink-3"
        >
          {e.source.short}
        </Link>
        {e.locatorLabel && <>, {e.locatorLabel}</>}
      </figcaption>
    </figure>
  );
}
