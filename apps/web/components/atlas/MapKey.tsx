import { cn } from "@/lib/utils";

/**
 * What the marks on the map mean, listing only what is drawn now. The
 * swatches are the map's own encodings (MapCanvas): dashed indigo shapes for
 * states, a hatch for culture areas, sandstone dots for places, turmeric for
 * events, paler for an uncertain location.
 */
export interface MapKeyShows {
  /** States drawn in the year shown: the subject's, and others (fainter) when there is a subject. */
  focus: number;
  others: number;
  cultures: number;
  places: number;
  events: number;
  uncertain: number;
  /** What the dotted outlines are ("Borders in 250 BCE, to compare"), when comparing. */
  compare: string | null;
}

export function MapKey({
  id,
  shows,
  focusLabel,
  className,
}: {
  id?: string;
  shows: MapKeyShows;
  /** The subject's name, when the map has one (else every state is drawn alike). */
  focusLabel: string | null;
  className?: string;
}) {
  const rows: { swatch: React.ReactNode; text: string }[] = [];
  if (focusLabel && shows.focus)
    rows.push({ swatch: <Shape strong />, text: `${focusLabel}, borders as reconstructed` });
  if (shows.others)
    rows.push({
      swatch: <Shape quiet={Boolean(focusLabel)} />,
      text: focusLabel ? "Other states of the time" : "A state, borders as reconstructed",
    });
  if (shows.cultures) rows.push({ swatch: <Hatch />, text: "A culture area, not a state" });
  if (shows.places) rows.push({ swatch: <Dot />, text: "A place, site or inscription" });
  if (shows.events) rows.push({ swatch: <Dot event />, text: "Where an event happened" });
  if (shows.uncertain)
    rows.push({
      swatch: <Dot pale />,
      text: "Paler: an uncertain location, or near the edge of its years",
    });
  if (shows.compare) rows.push({ swatch: <Dotted />, text: shows.compare });
  if (!rows.length) return null;
  return (
    <ul
      id={id}
      aria-label="Map key"
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-1 text-xs leading-5 text-ink-2 sm:flex sm:flex-wrap",
        className,
      )}
    >
      {rows.map((r) => (
        <li key={r.text} className="flex items-start gap-1.5 sm:items-center">
          {r.swatch}
          {r.text}
        </li>
      ))}
    </ul>
  );
}

const SW = "mt-1 h-3 w-4 shrink-0 sm:mt-0";

function Shape({ strong, quiet }: { strong?: boolean; quiet?: boolean }) {
  const color = quiet ? "var(--ink-3)" : "var(--indigo)";
  return (
    <svg viewBox="0 0 16 12" className={SW} aria-hidden>
      <rect
        x="1"
        y="1"
        width="14"
        height="10"
        rx="1.5"
        fill={color}
        fillOpacity={strong ? 0.22 : quiet ? 0.1 : 0.14}
        stroke={color}
        strokeWidth={strong ? 1.6 : 1}
        strokeDasharray="3 2"
      />
    </svg>
  );
}

function Hatch() {
  return (
    <svg viewBox="0 0 16 12" className={SW} aria-hidden>
      <defs>
        <pattern
          id="map-key-hatch"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--ink-3)" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect x="1" y="1" width="14" height="10" rx="1.5" fill="url(#map-key-hatch)" opacity="0.8" />
      <rect
        x="1"
        y="1"
        width="14"
        height="10"
        rx="1.5"
        fill="none"
        stroke="var(--ink-3)"
        strokeOpacity="0.6"
        strokeDasharray="3 2"
      />
    </svg>
  );
}

function Dot({ event, pale }: { event?: boolean; pale?: boolean }) {
  return (
    <svg viewBox="0 0 16 12" className={SW} aria-hidden>
      <circle
        cx="8"
        cy="6"
        r="4"
        fill={event ? "var(--turmeric)" : "var(--sandstone)"}
        fillOpacity={pale ? 0.45 : 1}
        stroke="var(--paper)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Dotted() {
  return (
    <svg viewBox="0 0 16 12" className={SW} aria-hidden>
      <rect
        x="1"
        y="1"
        width="14"
        height="10"
        rx="1.5"
        fill="none"
        stroke="var(--ink)"
        strokeOpacity="0.7"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="0.1 2.4"
      />
    </svg>
  );
}
