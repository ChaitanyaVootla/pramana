import type { TimelineItem } from "@pramana/services";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  DEEP_START,
  NOW,
  itemExtent,
  mid,
  packByPriority,
  pickTicks,
  spanLabel,
  stretchBreaks,
  textWidth,
  unitScale,
  type Extent,
} from "@/lib/time";
import { BAND_ON, DOTTED, SoftGradient, fadeFractions } from "./marks";
import styles from "./time.module.css";

/**
 * The time-rule band for an era page's hero: a full-bleed deep-indigo band.
 *
 * Upper rule: every age from 7000 BCE to now on the stretched scale, the
 * current era lit. Lower rule: a magnified lens of the era's own span, with
 * its people (reign or life bars, dotted when the dates are traditional), its
 * events (dots) and the era itself as a soft-ended bar. A faint wedge joins
 * the lit era above to its span below.
 *
 * Server component. Positions are percentages of the band's width so it needs
 * no measuring; labels are packed for a nominal width and keep their size.
 * Below 768px it collapses to a one-row mini rule.
 */

export interface TimeRuleBandProps {
  /** All ages (periods, polities, cultures) for the upper rule. */
  ages: TimelineItem[];
  /** The era this page is about; it is lit on the upper rule and magnified below. */
  focusId: string;
  /** People, events and other dated things to place on the lens. */
  lens: TimelineItem[];
  /** Where each mark links. Default: /e/<slug>. Return null for no link. */
  hrefFor?: (item: TimelineItem) => string | null;
  /** Left caption, e.g. <><b>Where this sits.</b> After the sixteen great states…</>. */
  caption?: ReactNode;
  /** Right caption: how to read the marks. Has a sensible default. */
  legend?: ReactNode;
}

/** Nominal width the labels are packed for (px). Narrower screens use the mini rule. */
const NW = 900;
const Y0 = 30; // upper rule
const ROW = 26; // lens row height
const pct = (u: number) => `${(u * 100).toFixed(3)}%`;

const DEFAULT_LEGEND = (
  <>
    Soft ends mean the date is approximate. Dotted means traditional, with no contemporary record.
  </>
);

interface LensMark {
  item: TimelineItem;
  e: Extent;
  x0: number; // nominal px
  x1: number;
  label: string;
  flip: boolean;
  dot: boolean;
  fade: { l: number; r: number } | null;
}

export function TimeRuleBand({
  ages,
  focusId,
  lens,
  hrefFor,
  caption,
  legend = DEFAULT_LEGEND,
}: TimeRuleBandProps) {
  const href = (i: TimelineItem) => (hrefFor ? hrefFor(i) : i.slug ? `/e/${i.slug}` : null);

  const ageMarks = ages
    .map((item) => ({ item, e: itemExtent(item) }))
    .filter((m): m is { item: TimelineItem; e: Extent } => m.e !== null)
    .sort((a, b) => a.e.start - b.e.start);
  const focus =
    ageMarks.find((m) => m.item.id === focusId) ??
    lens.map((item) => ({ item, e: itemExtent(item) })).find((m) => m.item.id === focusId);
  if (!focus?.e) return null;
  const fe = focus.e;

  const from = Math.min(DEEP_START, ...ageMarks.map((m) => m.e.start));
  const u = unitScale("stretched", from, NOW);

  // ---- upper rule -------------------------------------------------------
  const breaks = stretchBreaks();
  const upperTicks = pickTicks(from, NOW - 30, (y) => u(y) * NW, {
    gap: 18,
    extra: [from, ...breaks],
  });
  const focusIndex = ageMarks.findIndex((m) => m.item.id === focusId);
  const laneOf = (i: number) => i % 2;
  const barY = (i: number) => Y0 + 4 + laneOf(i) * 9;
  const focusBarY = focusIndex >= 0 ? barY(focusIndex) : Y0 + 4;

  // Neighbour labels: the age before and after, either side of the lit one.
  const prev = [...ageMarks].reverse().find((m) => m.e.start < fe.start && m.item.id !== focusId);
  const next = ageMarks.find((m) => m.e.start > fe.start && m.item.id !== focusId);
  const fx = ((u(fe.start) + u(fe.end)) / 2) * NW;
  const focusName = shortName(focus.item.label);
  const fw = textWidth(focusName, 12.5) + 4;
  const labelsY = Y0 + 36;

  // ---- lens -------------------------------------------------------------
  const span = Math.max(10, fe.end - fe.start);
  const lensItems = lens
    .filter((i) => i.id !== focusId)
    .map((item) => ({ item, e: itemExtent(item) }))
    .filter(
      (m): m is { item: TimelineItem; e: Extent } =>
        m.e !== null && m.e.end >= fe.start - span && m.e.start <= fe.end + span,
    );
  let L0 = fe.start - span * 0.3;
  let L1 = fe.end + span * 0.3;
  for (const m of lensItems) {
    L0 = Math.min(L0, Math.max(m.e.start, fe.start - span) - span * 0.05);
    L1 = Math.max(L1, Math.min(m.e.end, fe.end + span) + span * 0.05);
  }
  const eraLabel = `${focus.item.label}, ${focus.item.whenLabel || spanLabel(fe.start, fe.end, fe.approximate)}`;
  const eraLabelW = textWidth(eraLabel, 12.5) + 10;
  // Room to the right of the era bar for its label.
  // Widen the lens on the right so the era's label fits after its bar.
  const room = (NW - 12 - eraLabelW) / NW;
  if (room > 0.5) L1 = Math.max(L1, Math.min(L0 + (fe.end - L0) / room, fe.end + span));
  const z = (y: number) => (y - L0) / (L1 - L0);

  const marks: LensMark[] = lensItems
    .map(({ item, e }) => {
      const dot = e.point || (z(e.end) - z(e.start)) * NW < 3;
      const x0 = Math.max(0, z(dot ? mid(e) : e.start) * NW);
      const x1 = Math.min(NW, z(dot ? mid(e) : e.end) * NW);
      const label = `${item.label}, ${e.whenLabel}`;
      const w = textWidth(label, 12.5);
      const flip = dot ? x0 + 9 + w > NW : x0 + w > NW;
      const f = dot || e.uncertain ? null : fadeFractions(x1 - x0, (z(1) - z(0)) * NW, e);
      const fade = f && (f.l || f.r) ? f : null;
      return { item, e, x0, x1, label, flip, dot, fade };
    })
    .sort((a, b) => a.x0 - b.x0);
  const footprints = marks.map((m) => {
    const w = textWidth(m.label, 12.5);
    if (m.dot)
      return m.flip
        ? { left: m.x0 - 9 - w, right: m.x0 + 4, markLeft: m.x0 - 4, markRight: m.x0 + 4 }
        : { left: m.x0 - 4, right: m.x0 + 9 + w, markLeft: m.x0 - 4, markRight: m.x0 + 4 };
    return m.flip
      ? { left: Math.min(m.x0, m.x1 - w), right: m.x1, markLeft: m.x0, markRight: m.x1 }
      : { left: m.x0, right: Math.max(m.x1, m.x0 + w), markLeft: m.x0, markRight: m.x1 };
  });
  // Reigns and lives sit nearest the rule, then events, then traditional dates.
  const rank = (m: LensMark) => (m.e.uncertain ? 2 : m.dot ? 1 : 0);
  const order = marks
    .map((m, i) => i)
    .sort((a, b) => rank(marks[a]!) - rank(marks[b]!) || marks[a]!.x0 - marks[b]!.x0);
  const rowIdx = packByPriority(
    order.map((i) => footprints[i]!),
    14,
    6,
  );
  const rowOf = new Array<{ row: number; labelled: boolean }>(marks.length);
  order.forEach((i, k) => (rowOf[i] = { row: rowIdx[k]!, labelled: true }));
  const packed = { rows: Math.max(0, ...rowIdx) + 1 };
  const rows = marks.length ? packed.rows : 0;
  const YZ = labelsY + 34 + rows * ROW;
  const H = YZ + 30;
  const lensTicks = pickTicks(L0, L1, (y) => z(y) * NW, { gap: 24, size: 12 });

  const eraX0 = z(fe.start);
  const eraX1 = z(fe.end);
  const eraLabelRight = eraX1 * NW + 8 + eraLabelW <= NW;
  const idBase = `trb-${focusId.slice(-8)}`;

  return (
    <section
      aria-label={`Where ${focus.item.label} sits in Indian history`}
      className="bg-indigo-deep text-band-label"
    >
      <div className="frame pt-4 pb-4">
        {/* Full band (768px and up) */}
        <svg
          className="hidden w-full overflow-visible font-sans text-xs tabular md:block"
          height={H}
          role="group"
          aria-label={`Upper rule: Indian history from 7000 BCE to now, with ${focus.item.label} lit. Lower rule: ${focus.item.label} magnified, ${spanLabel(L0, L1)}.`}
        >
          <defs>
            {ageMarks.map(({ item, e }, i) => {
              const w = (u(e.end) - u(e.start)) * NW;
              const f = fadeFractions(w, w / Math.max(1, e.end - e.start), e);
              return f.l || f.r ? (
                <SoftGradient
                  key={item.id}
                  id={`${idBase}-a${i}`}
                  color={item.id === focusId ? BAND_ON : "var(--band-era)"}
                  fadeL={f.l}
                  fadeR={f.r}
                  floor={0.2}
                />
              ) : null;
            })}
            <SoftGradient
              id={`${idBase}-era`}
              color={BAND_ON}
              fadeL={fe.approximate ? 0.1 : 0}
              fadeR={fe.approximate ? 0.08 : 0}
              floor={0}
            />
            {marks.map((m, i) => {
              if (!m.fade) return null;
              const f = m.fade;
              return (
                <SoftGradient
                  key={m.item.id}
                  id={`${idBase}-l${i}`}
                  color="var(--band-person)"
                  fadeL={f.l}
                  fadeR={f.r}
                  floor={0.15}
                />
              );
            })}
          </defs>

          {/* The wedge from the lit era to its magnified span */}
          <svg
            width="100%"
            height={H}
            viewBox={`0 0 100 ${H}`}
            preserveAspectRatio="none"
            aria-hidden
            className={styles.wedge}
          >
            <polygon
              points={`${u(fe.start) * 100},${focusBarY + 7} ${u(fe.end) * 100},${focusBarY + 7} ${eraX1 * 100},${YZ - 3} ${eraX0 * 100},${YZ - 3}`}
              fill={BAND_ON}
              fillOpacity={0.07}
            />
          </svg>

          {/* Upper rule */}
          <line x1="0" x2="100%" y1={Y0} y2={Y0} stroke="var(--band-tick)" />
          {upperTicks.map((t, i) => (
            <g key={t.year}>
              {!breaks.includes(t.year) && (
                <line
                  x1={pct(t.x / NW)}
                  x2={pct(t.x / NW)}
                  y1={Y0 - 5}
                  y2={Y0 + 5}
                  stroke="var(--band-lane)"
                />
              )}
              <text
                x={pct(t.x / NW)}
                y={Y0 - 10}
                textAnchor={i === 0 && t.x < 30 ? "start" : "middle"}
                fill="var(--band-label)"
              >
                {t.label}
              </text>
            </g>
          ))}
          {breaks.map((b) => (
            <svg key={b} x={pct(u(b))} y={Y0} overflow="visible" aria-hidden>
              <title>The scale changes here</title>
              <rect x={-4} y={-2} width={8} height={4} fill="var(--indigo-deep)" />
              <path d="M-5 4.5 L-1 -4.5 M1 4.5 L5 -4.5" stroke="var(--band-lane)" fill="none" />
            </svg>
          ))}
          <line x1="100%" x2="100%" y1={Y0 - 7} y2={Y0 + 7} stroke={BAND_ON} strokeWidth={1.5} />
          <text x="100%" y={Y0 - 10} textAnchor="end" fill={BAND_ON} fontWeight={600}>
            now
          </text>
          {ageMarks.map(({ item, e }, i) => {
            const on = item.id === focusId;
            const w = (u(e.end) - u(e.start)) * NW;
            const fill = hasFade(w, e) ? `url(#${idBase}-a${i})` : on ? BAND_ON : "var(--band-era)";
            const link = href(item);
            const bar = (
              <>
                <title>{`${item.label}, ${e.whenLabel}`}</title>
                <rect
                  x={pct(u(e.start))}
                  y={barY(i)}
                  width={w < 2 ? 2 : pct(u(e.end) - u(e.start))}
                  height={7}
                  rx={1}
                  fill={fill}
                  opacity={on ? 1 : 0.8}
                />
              </>
            );
            return link ? (
              <Link
                key={item.id}
                href={link}
                className={styles.mark}
                aria-label={`${item.label}, ${e.whenLabel}`}
              >
                {bar}
              </Link>
            ) : (
              <g key={item.id}>{bar}</g>
            );
          })}
          {prev && (
            <text
              x={pct(Math.min(((u(prev.e.start) + u(prev.e.end)) / 2) * NW, fx - fw / 2 - 12) / NW)}
              y={labelsY}
              textAnchor="end"
              fill="var(--band-lane)"
            >
              {shortName(prev.item.label)}
            </text>
          )}
          <text x={pct(fx / NW)} y={labelsY} textAnchor="middle" fill={BAND_ON} fontWeight={600}>
            {focusName}
          </text>
          {next && (
            <text
              x={pct(Math.max(((u(next.e.start) + u(next.e.end)) / 2) * NW, fx + fw / 2 + 12) / NW)}
              y={labelsY}
              fill="var(--band-lane)"
            >
              {shortName(next.item.label)}
            </text>
          )}

          {/* The lens */}
          <g className={styles.lens}>
            {marks.map((m, i) => {
              const { row, labelled } = rowOf[i]!;
              const y = YZ - 30 - row * ROW;
              const link = href(m.item);
              const x0 = pct(m.x0 / NW);
              const shape = m.dot ? (
                <circle cx={x0} cy={y} r={3.5} fill="var(--band-event)" />
              ) : m.e.uncertain ? (
                <line
                  x1={x0}
                  x2={pct(m.x1 / NW)}
                  y1={y}
                  y2={y}
                  stroke="var(--band-person)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={DOTTED}
                />
              ) : (
                <rect
                  x={x0}
                  y={y - 1.5}
                  width={pct((m.x1 - m.x0) / NW)}
                  height={3}
                  rx={1.5}
                  fill={m.fade ? `url(#${idBase}-l${i})` : "var(--band-person)"}
                />
              );
              const text = labelled ? (
                m.dot ? (
                  <text
                    x={x0}
                    dx={m.flip ? -9 : 9}
                    y={y + 4}
                    textAnchor={m.flip ? "end" : "start"}
                    fill="var(--band-event)"
                    fontSize={12.5}
                  >
                    {m.label}
                  </text>
                ) : (
                  <text
                    x={m.flip ? pct(m.x1 / NW) : x0}
                    y={y - 7}
                    textAnchor={m.flip ? "end" : "start"}
                    fill="var(--band-event)"
                    fontSize={12.5}
                  >
                    {m.label}
                  </text>
                )
              ) : null;
              const body = (
                <>
                  <title>{m.label}</title>
                  {shape}
                  {text}
                </>
              );
              return link ? (
                <Link key={m.item.id} href={link} className={styles.mark} aria-label={m.label}>
                  {body}
                </Link>
              ) : (
                <g key={m.item.id}>{body}</g>
              );
            })}
          </g>

          {/* Lower rule */}
          <line x1="0" x2="100%" y1={YZ} y2={YZ} stroke="var(--band-tick)" />
          {lensTicks.map((t, i) => (
            <g key={t.year}>
              {!(eraLabelRight && t.x > eraX1 * NW && t.x < eraX1 * NW + eraLabelW + 4) && (
                <line
                  x1={pct(t.x / NW)}
                  x2={pct(t.x / NW)}
                  y1={YZ - 4}
                  y2={YZ + 4}
                  stroke="var(--band-lane)"
                />
              )}
              <text
                x={pct(t.x / NW)}
                y={YZ + 19}
                textAnchor={
                  i === 0 && t.x < 30
                    ? "start"
                    : i === lensTicks.length - 1 && t.x > NW - 30
                      ? "end"
                      : "middle"
                }
                fill="var(--band-lane)"
              >
                {t.label}
              </text>
            </g>
          ))}
          <rect
            x={pct(eraX0)}
            y={YZ - 3}
            width={pct(eraX1 - eraX0)}
            height={6}
            rx={1}
            fill={fe.approximate ? `url(#${idBase}-era)` : BAND_ON}
            className={styles.grow}
          />
          <text
            x={eraLabelRight ? pct(eraX1) : pct(eraX0)}
            dx={eraLabelRight ? 8 : 0}
            y={eraLabelRight ? YZ + 4 : YZ - 10}
            fill={BAND_ON}
            fontWeight={600}
            fontSize={12.5}
            className={styles.lens}
          >
            {eraLabel}
          </text>
        </svg>

        {/* Mini rule (below 768px): the whole span on one row, the era lit */}
        <svg
          className="block w-full overflow-visible font-sans text-xs tabular md:hidden"
          height={54}
          role="img"
          aria-label={`${focus.item.label} on the line of Indian history from 7000 BCE to now`}
        >
          <line x1="0" x2="100%" y1={20} y2={20} stroke="var(--band-tick)" />
          {ageMarks.map(({ item, e }, i) => (
            <rect
              key={item.id}
              x={pct(u(e.start))}
              y={16 + laneOf(i) * 6 - 2}
              width={pct(Math.max(0.004, u(e.end) - u(e.start)))}
              height={item.id === focusId ? 10 : 5}
              rx={1}
              fill={item.id === focusId ? BAND_ON : "var(--band-era)"}
              opacity={item.id === focusId ? 1 : 0.8}
            />
          ))}
          <text x="0" y={46} fill="var(--band-label)">
            7000 BCE
          </text>
          <text x={pct(u(1))} y={46} textAnchor="middle" fill="var(--band-label)">
            1 CE
          </text>
          <text x="100%" y={46} textAnchor="end" fill={BAND_ON} fontWeight={600}>
            now
          </text>
        </svg>

        {(caption || legend) && (
          <div className="mt-1 flex flex-col gap-1.5 font-sans text-sm leading-snug text-band-label md:flex-row md:justify-between md:gap-12 [&_b]:font-semibold [&_b]:text-band-on">
            {caption && <p className="max-w-[72ch]">{caption}</p>}
            {legend && <p className="max-w-[56ch] text-band-lane md:text-right">{legend}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function hasFade(w: number, e: Extent): boolean {
  const f = fadeFractions(w, w / Math.max(1, e.end - e.start), e);
  return Boolean(f.l || f.r);
}

/** "Maurya Empire" -> "Maurya" on the crowded upper rule; other names as they are. */
function shortName(label: string): string {
  return label.replace(/\s+(Empire|period|civilisation|Confederacy|Sultanate)$/i, "");
}
