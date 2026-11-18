"use client";

import { AddToCanvas } from "@/components/canvas/AddToCanvas";
import { formatYear } from "@pramana/core";
import type { ClaimCard, EntityCard, NoteView } from "@pramana/services";
import { Map as MapIcon, MapPin, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePointAt } from "@/components/atlas/bus";
import { CERTAINTY_WORDS, EntityChip } from "@/components/chips/Chips";
import { initialOf } from "@/lib/names";
import { useReader } from "@/components/chips/reader";
import { TimeStrip } from "@/components/time/TimeStrip";
import { EntityThumb, MediaTile, type ViewerMedia } from "@/components/media";
import { Button } from "@/components/ui/button";
import { claimTier, datedLabel, stripMark, yearOf } from "@/lib/era";
import { cn } from "@/lib/utils";
import { EvidenceSeal } from "@/components/evidence/EvidenceSeal";
import { NoteCard, type NoteAction } from "@/components/ai/NoteCard";
import { setNoteStatusAction } from "@/app/notes/actions";

const MiniMap = dynamic(() => import("@/components/map/MiniMap").then((m) => m.MiniMap), {
  ssr: false,
  loading: () => <div className="h-[150px] animate-pulse rounded-lg bg-rule-soft" />,
});

/** A rail block: a small sans title over its content, under a rule; the rail and the hero are stacks of these. */
export function Panel({
  id,
  title,
  action,
  children,
  className,
}: {
  id?: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // Rail blocks are a heading and content under a rule, not boxes (docs/visual.md §5).
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      className={cn("min-w-0 border-t border-rule pt-4", className)}
    >
      {(title || action) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && (
            <h2 className="font-sans text-ui font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const SPAN_WORDS: Record<string, string> = {
  reign: "reigned",
  life: "lived",
  floruit: "active",
  activity: "active",
};
const SPAN_ORDER = Object.keys(SPAN_WORDS);

/** A person's reign and life as strips within the period, so "when" reads at a glance. */
function PersonSpans({ person, within }: { person: EntityCard; within: [number, number] }) {
  const spans = (person.spans ?? [])
    .filter((s) => s.role in SPAN_WORDS && s.bounds.startMin !== null)
    .sort((a, b) => SPAN_ORDER.indexOf(a.role) - SPAN_ORDER.indexOf(b.role))
    .slice(0, 2);
  const rows = spans.length
    ? spans.map((s) => ({
        key: s.role,
        word: SPAN_WORDS[s.role]!,
        label: s.label,
        bounds: s.bounds,
      }))
    : person.bounds?.startMin != null
      ? [{ key: "when", word: "", label: person.whenLabel ?? "", bounds: person.bounds }]
      : [];
  if (!rows.length) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {rows.map((r) => {
        const mark = stripMark(r.bounds);
        return (
          <li key={r.key} className="flex items-center gap-2 text-xs text-ink-3 tnum">
            {mark !== null && (
              <TimeStrip
                within={within}
                mark={mark}
                approximate={r.bounds.approximate}
                width={72}
                height={5}
              />
            )}
            <span className="min-w-0 truncate">
              {r.word && `${r.word} `}
              {r.label.replace(/^(reigned|lived|born|died)\s+/i, "")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Person({ person, within }: { person: EntityCard; within: [number, number] | null }) {
  const initial = initialOf(person);
  const point = usePointAt([person.id]);
  return (
    <li className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0" {...point}>
      {person.image ? (
        <EntityThumb image={person.image} size={40} decorative />
      ) : (
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-indigo-wash font-serif text-lg text-indigo"
          lang={initial.lang}
          aria-hidden
        >
          {initial.char}
        </span>
      )}
      <div className="min-w-0 flex-1 font-sans">
        <Link
          href={`/e/${person.slug}`}
          className="text-ui font-medium text-ink no-underline hover:underline"
        >
          {person.label}
        </Link>
        {person.description && (
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-ink-2">
            {person.description}
          </p>
        )}
        {within && <PersonSpans person={person} within={within} />}
      </div>
    </li>
  );
}

/** A writer or speaker whose words are the evidence: one quiet line, name and dates. */
function Witness({ person }: { person: EntityCard }) {
  const point = usePointAt([person.id]);
  return (
    <li className="flex items-baseline gap-2" {...point}>
      <Link
        href={`/e/${person.slug}`}
        className="text-ink-2 no-underline hover:text-ink hover:underline"
      >
        {person.label}
      </Link>
      {datedLabel(person) && <span className="text-xs text-ink-3 tnum">{datedLabel(person)}</span>}
    </li>
  );
}

/**
 * The quiet default of the context card: for the part being read, who is
 * here (with when they reigned or lived), its places, its pictures, and words
 * to know. It follows the reader; the map does not. "Show its map" moves the
 * map to the part, and only when the reader asks.
 */
export function InThisPart({
  index,
  title,
  people,
  witnesses = [],
  places,
  terms,
  within,
  ask,
  showMap,
  pictures = [],
}: {
  /** "Ask your AI about this part". */
  ask?: React.ReactNode;
  /** The map in the part's year, with its places framed (when the page has an atlas). */
  showMap?: { year: string | null; go: () => void } | null;
  /** Pictures attached to the part, beyond any shown beside its summary. */
  pictures?: { key: string; media: ViewerMedia; caption?: string }[];
  index: number;
  title: string;
  people: EntityCard[];
  /** People whose words about the events are the evidence (Marx on 1857), shown apart and quieter. */
  witnesses?: EntityCard[];
  places: EntityCard[];
  terms: EntityCard[];
  within: [number, number] | null;
}) {
  const empty = people.length + witnesses.length + places.length + terms.length === 0;
  return (
    <Panel
      title={<>You are in Part {index + 1}</>}
      action={
        showMap ? (
          <button
            type="button"
            onClick={showMap.go}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm font-sans text-sm font-medium text-indigo hover:underline"
          >
            <MapIcon className="size-3.5" aria-hidden />
            Show its map
            {showMap.year && <span className="font-normal text-ink-3 tnum">{showMap.year}</span>}
          </button>
        ) : null
      }
    >
      <p className="-mt-2 mb-3 font-serif text-lg leading-snug text-ink" aria-live="polite">
        {title}
      </p>
      {pictures.length > 0 && (
        <ul
          aria-label="Pictures in this part"
          className={cn("mb-4 grid gap-2", pictures.length === 1 ? "grid-cols-2" : "grid-cols-3")}
        >
          {pictures.map((p) => (
            <li key={p.key} className="aspect-square min-w-0">
              <MediaTile media={p.media} caption={p.caption} fit="cover" />
            </li>
          ))}
        </ul>
      )}
      {places.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1.5 font-sans text-xs font-medium text-ink-3">Places</h3>
          <ul className="flex flex-wrap gap-1.5">
            {places.map((p) => (
              <li key={p.id}>
                <EntityChip entity={p} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {people.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 font-sans text-xs font-medium text-ink-3">Who took part</h3>
          <ul className="divide-y divide-rule-soft">
            {people.map((p) => (
              <Person key={p.id} person={p} within={within} />
            ))}
          </ul>
        </div>
      )}
      {witnesses.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1.5 font-sans text-xs font-medium text-ink-3">Who wrote about it</h3>
          <ul className="space-y-1 font-sans text-sm">
            {witnesses.map((p) => (
              <Witness key={p.id} person={p} />
            ))}
          </ul>
        </div>
      )}
      {terms.length > 0 && (
        <div>
          <h3 className="mb-1.5 font-sans text-xs font-medium text-ink-3">Words to know</h3>
          <dl className="space-y-2 font-sans text-note">
            {terms.map((t) => (
              <div key={t.id}>
                <dt className="font-medium text-ink">{t.label}</dt>
                <dd className="leading-snug text-ink-2">{t.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <p
        className={cn(
          "font-sans text-ink-3",
          empty ? "text-note" : "mt-4 border-t border-rule-soft pt-3 text-xs",
        )}
      >
        Select a claim to see its sources here, or a place to find it on the map.
      </p>
      {ask && <div className="mt-3">{ask}</div>}
    </Panel>
  );
}

const KIND_WORDS: Record<string, string> = {
  place: "Place",
  site: "Site",
  inscription: "Inscription",
  event: "Event",
  person: "Person",
  polity: "State",
};

/** A place the reader picked: what it is, how sure we are where it was, and what this page says about it. */
export function PlaceCard({
  entity,
  claims,
  onSelectClaim,
  onClose,
  showMap = false,
}: {
  entity: EntityCard;
  /** Claims on this page that name it. */
  claims: ClaimCard[];
  onSelectClaim: (id: string) => void;
  onClose?: () => void;
  /** Draw a small map (phones, where the atlas is out of sight). */
  showMap?: boolean;
}) {
  const { showYear } = useReader();
  // An event (or a site with a date) can show the map in its year.
  const year = showYear && entity.kind === "event" ? yearOf(entity.bounds) : null;
  return (
    <section className="min-w-0 font-sans" aria-label={entity.label}>
      <div className="flex items-start gap-2">
        {entity.image ? (
          <EntityThumb image={entity.image} size={48} decorative className="mr-1" />
        ) : (
          <MapPin className="mt-1.5 size-4 shrink-0 text-sandstone" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl leading-tight text-ink">{entity.label}</h2>
          <p className="mt-0.5 text-sm text-ink-3 tnum">
            {KIND_WORDS[entity.kind] ?? "Place"}
            {datedLabel(entity) ? `, ${datedLabel(entity)}` : ""}
          </p>
        </div>
        <AddToCanvas content={{ kind: "entity", entity: entity.id }} what={entity.label} icon />
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        )}
      </div>
      {entity.description && (
        <p className="mt-2.5 text-note leading-snug text-ink-2">{entity.description}</p>
      )}
      {showMap && entity.geo && (
        <div className="mt-3 overflow-hidden rounded-lg">
          <MiniMap
            features={[
              {
                id: entity.id,
                slug: entity.slug,
                label: entity.label,
                kind: entity.kind,
                whenLabel: entity.whenLabel,
                geo: entity.geo,
              },
            ]}
            height={150}
          />
        </div>
      )}
      <p className="mt-2.5 text-sm text-ink-3">
        {entity.geo ? (
          <>
            {CERTAINTY_WORDS[entity.geo.certainty]}
            {entity.geo.note ? ` ${entity.geo.note}` : ""}
          </>
        ) : ["polity", "period", "culture"].includes(entity.kind) ? (
          "Its borders on the map are reconstructions, not surveyed lines."
        ) : (
          "No location recorded yet."
        )}
      </p>
      {year !== null && (
        <button
          type="button"
          onClick={() => showYear!(year)}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-indigo hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MapIcon className="size-3.5" aria-hidden /> Show the map in {formatYear(year)}
        </button>
      )}
      {claims.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 font-sans text-xs font-medium text-ink-3">On this page</h3>
          <ul className="-mx-2 space-y-px">
            {claims.slice(0, 5).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelectClaim(c.id)}
                  className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-rule-soft focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1 font-serif text-note leading-snug text-ink">
                    {c.text}
                  </span>
                  <EvidenceSeal level={c.level} tier={claimTier(c)} className="mt-1" />
                </button>
              </li>
            ))}
          </ul>
          {claims.length > 5 && (
            <p className="mt-1 text-xs text-ink-3">and {claims.length - 5} more</p>
          )}
        </div>
      )}
      <Link
        href={`/e/${entity.slug}`}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo no-underline hover:underline"
      >
        Everything about {entity.label}
      </Link>
    </section>
  );
}

/** Answers posted by a study session, newest first. */
export function NotesPanel({
  notes,
  fresh,
  onDismiss,
}: {
  notes: NoteView[];
  fresh: Set<string>;
  onDismiss: (id: string) => void;
}) {
  if (!notes.length) return null;
  // Archive goes through the page (it drops the note at once); pin and unpin come back as a live event.
  const act = (note: NoteView, action: NoteAction) =>
    action === "archive"
      ? onDismiss(note.id)
      : void setNoteStatusAction(note.id, action === "pin" ? "pinned" : "live");
  return (
    <Panel
      title="From your AI"
      action={
        <Link href="/notes" className="font-sans text-sm text-ink-3 no-underline hover:text-ink">
          Notes history
        </Link>
      }
    >
      <ol className="space-y-5">
        {notes.slice(0, 3).map((n) => (
          <li key={n.id}>
            <NoteCard note={n} fresh={fresh.has(n.id)} onAction={act} />
          </li>
        ))}
      </ol>
    </Panel>
  );
}
