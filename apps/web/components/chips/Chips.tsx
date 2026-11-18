"use client";

import { useYourView } from "@/components/yourview/YourView";
import { formatYear, type DateBounds } from "@pramana/core";
import type { EntityCard } from "@pramana/services";
import { CalendarDays, Map as MapIcon, MapPin, User } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePointAt } from "@/components/atlas/bus";
import { EntityThumb } from "@/components/media";
import { datedLabel, yearOf, yearsAgo } from "@/lib/era";
import { initialOf } from "@/lib/names";
import { cn } from "@/lib/utils";
import { MiniStrip } from "./MiniStrip";
import { isLocated, useReader } from "./reader";

const MiniMap = dynamic(() => import("@/components/map/MiniMap").then((m) => m.MiniMap), {
  ssr: false,
  loading: () => <div className="h-[120px] animate-pulse rounded-lg bg-rule-soft" />,
});

/*
 * Chips: 28px tall, 4px radius (the smallest radius in the system), a quiet
 * border that darkens on hover and focus. Colour is meaning: indigo for time,
 * sandstone for places; people and other things are ink on paper.
 */
export const CHIP =
  "inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-sm border px-2 align-[-6px] font-sans text-sm font-medium leading-none whitespace-nowrap no-underline transition-[background-color,border-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export const CERTAINTY_WORDS: Record<string, string> = {
  exact: "The location is known.",
  approximate: "The location is approximate.",
  conjectural: "The location is a scholarly guess.",
};

/** `[▬┃▬ c. 261 BCE]`: a date, placed within the span around it. */
export function DateChip({
  label,
  bounds,
  within,
  asStated,
  basis,
  about,
}: {
  label: string;
  bounds?: DateBounds | null;
  within?: [number, number] | null;
  asStated?: string | null;
  basis?: string | null;
  /** What happened then (an event), offered as a link in the popover. */
  about?: { label: string; href: string } | null;
}) {
  const ago = yearsAgo(bounds);
  const { showYear, revealMap } = useReader();
  const year = showYear ? yearOf(bounds) : null;
  // Inside a page with an atlas, the chip is the reader's way to move the map to this date.
  return (
    <Popover>
      <PopoverTrigger
        onClick={() => {
          if (showYear && year !== null) showYear(year);
        }}
        title={showYear && year !== null ? `Show the map in ${formatYear(year)}` : undefined}
        className={cn(
          CHIP,
          "border-indigo-tint/60 bg-indigo-wash text-indigo hover:border-indigo aria-expanded:border-indigo",
        )}
      >
        {within && bounds ? (
          <MiniStrip within={within} bounds={bounds} />
        ) : (
          <CalendarDays className="size-3.5" aria-hidden />
        )}
        <span className="tnum">{label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-72 gap-0 font-sans text-note">
        <p className="font-serif text-lg text-ink tnum">{label}</p>
        {ago && <p className="text-ink-2">{ago}</p>}
        {asStated && (
          <p className="mt-2.5 text-ink-2">
            The source says: <span className="font-serif text-ink italic">“{asStated}”</span>
          </p>
        )}
        {basis && <p className="mt-2 text-sm text-ink-3">How this date was set: {basis}</p>}
        {bounds?.approximate && (
          <p className="mt-2 text-sm text-ink-3">Approximate: soft edges on the timeline.</p>
        )}
        {showYear && year !== null && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-indigo">
            <MapIcon className="size-3.5" aria-hidden /> The map now shows {formatYear(year)}.
            {revealMap && (
              <button
                type="button"
                onClick={revealMap}
                className="ml-1 font-medium underline underline-offset-2"
              >
                See it
              </button>
            )}
          </p>
        )}
        {about && (
          <Link
            href={about.href}
            className="mt-2 inline-block text-sm font-medium text-indigo no-underline hover:underline"
          >
            Everything about {about.label}
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}

const PLACE_CHIP =
  "border-sandstone/30 bg-sandstone-wash text-sandstone-ink hover:border-sandstone aria-expanded:border-sandstone aria-pressed:border-sandstone";

/**
 * `[⌖ Kalinga]` in sandstone: a place. Pointing at it lights it on the atlas.
 * Inside a page reader, clicking opens its card beside the reading and frames
 * it on the map; elsewhere a popover shows a mini-map and how sure we are where it was.
 */
export function PlaceChip({ entity, label }: { entity: EntityCard; label?: string }) {
  const reader = useReader();
  const point = usePointAt([entity.id]);
  if (reader.selectEntity) {
    return (
      <button
        type="button"
        {...point}
        onClick={() => reader.selectEntity!(entity.id)}
        aria-pressed={reader.selectedEntity === entity.id}
        className={cn(CHIP, PLACE_CHIP, "aria-pressed:bg-sandstone/15")}
      >
        <MapPin className="size-3.5" aria-hidden />
        {label ?? entity.label}
      </button>
    );
  }
  return (
    <Popover>
      <PopoverTrigger {...point} className={cn(CHIP, PLACE_CHIP)}>
        <MapPin className="size-3.5" aria-hidden />
        {label ?? entity.label}
      </PopoverTrigger>
      <PopoverContent className="w-80 gap-0 font-sans text-note">
        <div className="flex items-start gap-3">
          {entity.image && <EntityThumb image={entity.image} size={40} decorative />}
          <p className="min-w-0 flex-1 font-serif text-lg text-ink">{entity.label}</p>
        </div>
        {entity.description && <p className="mt-0.5 text-ink-2">{entity.description}</p>}
        {entity.geo ? (
          <>
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
                height={130}
              />
            </div>
            <p className="mt-2 text-sm text-ink-3">
              {CERTAINTY_WORDS[entity.geo.certainty]}
              {entity.geo.note ? ` ${entity.geo.note}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-3">No location recorded yet.</p>
        )}
        <Link
          href={`/e/${entity.slug}`}
          className="mt-3 inline-block text-sm font-medium text-indigo no-underline hover:underline"
        >
          Everything about {entity.label}
        </Link>
      </PopoverContent>
    </Popover>
  );
}

/** `[☺ Megasthenes]`: a person, with who they were and when, on hover, focus or tap. */
export function PersonChip({
  entity,
  label,
  within,
}: {
  entity: EntityCard;
  label?: string;
  within?: [number, number] | null;
}) {
  const initial = initialOf(entity);
  const point = usePointAt([entity.id]);
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        render={<Link href={`/e/${entity.slug}`} />}
        {...point}
        className={cn(CHIP, "border-rule bg-paper text-ink shadow-card hover:border-ink-3/60")}
      >
        <User className="size-3.5 text-ink-3" aria-hidden />
        {label ?? entity.label}
      </HoverCardTrigger>
      <HoverCardContent className="w-72 font-sans text-note">
        <div className="flex gap-3">
          {entity.image ? (
            <EntityThumb image={entity.image} size={40} decorative />
          ) : (
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-wash font-serif text-xl text-indigo"
              lang={initial.lang}
            >
              {initial.char}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-serif text-lg leading-tight text-ink">{entity.label}</p>
            {entity.whenLabel && (
              <p className="mt-0.5 text-sm text-ink-2 tnum">{datedLabel(entity)}</p>
            )}
          </div>
        </div>
        {entity.description && (
          <p className="mt-2.5 leading-snug text-ink-2">{entity.description}</p>
        )}
        {within && entity.bounds && (
          <div className="mt-3">
            <MiniStrip within={within} bounds={entity.bounds} width={240} />
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

/** A glossary word: dotted underline, its meaning on hover, focus or tap. */
export function GlossaryTerm({
  entity,
  children,
}: {
  entity: EntityCard;
  children?: React.ReactNode;
}) {
  // A button that opens a small definition: on hover or focus with a pointer, on tap on touch;
  // it stays until dismissed (Esc, or a click elsewhere), so it can be read and copied.
  // With "Explain words where they appear" in the learner's view, a short gloss follows the word too.
  const explain = useYourView()?.view.explainWords && entity.description;
  const gloss = explain
    ? entity.description!.split(/(?<=[.;:])\s/)[0]!.replace(/[.;:]$/, "")
    : null;
  return (
    <>
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={250}
          render={<button type="button" />}
          className="term rounded-[2px] bg-transparent p-0 text-inherit [font:inherit] focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children ?? entity.label}
        </PopoverTrigger>
        <PopoverContent className="w-64 gap-1 px-3 py-2.5 font-sans text-sm leading-snug">
          <p className="font-semibold text-ink">{entity.label}</p>
          <p className="text-ink-2">{entity.description ?? "No definition yet."}</p>
          <Link
            href={`/e/${entity.slug}`}
            className="text-xs font-medium text-indigo no-underline hover:underline"
          >
            More about this word
          </Link>
        </PopoverContent>
      </Popover>
      {gloss && (
        <span className="font-sans text-[0.85em] text-ink-2">
          {" "}
          ({gloss.length > 90 ? `${gloss.slice(0, 88)}…` : gloss})
        </span>
      )}
    </>
  );
}

/** Chooses the right chip for an entity; one the learner brought out in their view gets a ring. */
export function EntityChip(props: {
  entity: EntityCard;
  label?: string;
  within?: [number, number] | null;
}) {
  const emphasised = useYourView()?.emphasised(props.entity.id, props.entity.slug);
  if (!emphasised) return <ChipFor {...props} />;
  return (
    <span
      className="inline-flex rounded-[5px] ring-2 ring-indigo/40 ring-offset-1 ring-offset-paper"
      title="You asked to bring this out"
    >
      <ChipFor {...props} />
    </span>
  );
}

function ChipFor({
  entity,
  label,
  within,
}: {
  entity: EntityCard;
  label?: string;
  within?: [number, number] | null;
}) {
  if (entity.kind === "person") return <PersonChip entity={entity} label={label} within={within} />;
  if (isLocated(entity)) return <PlaceChip entity={entity} label={label} />;
  if (entity.kind === "term") return <GlossaryTerm entity={entity}>{label}</GlossaryTerm>;
  return (
    <Link
      href={`/e/${entity.slug}`}
      className={cn(CHIP, "border-rule bg-paper text-ink shadow-card hover:border-ink-3/60")}
    >
      {label ?? entity.label}
    </Link>
  );
}
