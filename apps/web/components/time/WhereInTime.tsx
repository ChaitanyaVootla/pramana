import { shortYear, textWidth } from "@/lib/time";

/**
 * "Where in the empire's life", for the context rail: a 280px strip of an
 * era's span, with a highlighted sub-span (a reign) and a tick for this
 * chapter's date, all labelled. Server-safe.
 *
 *   <WhereInTime
 *     span={{ from: -321, to: -184 }}
 *     highlight={{ from: -267, to: -231, label: "Aśoka's reign" }}
 *     mark={{ year: -260, label: "Kalinga, c. 261 BCE", note: "year 8 of his reign" }}
 *   />
 */
export interface WhereInTimeProps {
  /** The enclosing span, astronomical years. Labels default to the years. */
  span: { from: number; to: number; fromLabel?: string; toLabel?: string };
  /** A sub-span drawn darker, e.g. a reign. */
  highlight?: { from: number; to: number; label?: string };
  /** A tick for this chapter's date, with a label and an optional note above it. */
  mark?: { year: number; label: string; note?: string };
  /** Default 280. */
  width?: number;
  className?: string;
}

const SIZE = 12;

export function WhereInTime({ span, highlight, mark, width = 280, className }: WhereInTimeProps) {
  const len = Math.max(1, span.to - span.from);
  const lo = span.from - len * 0.1;
  const hi = span.to + len * 0.1;
  const x = (y: number) => ((y - lo) / (hi - lo)) * width;
  const clampX = (cx: number, label: string, size = SIZE) => {
    const half = textWidth(label, size) / 2;
    return Math.min(width - half, Math.max(half, cx));
  };

  const top = mark ? (mark.note ? 34 : 20) : 4;
  const barY = top + 8;
  const labelY = barY + 20;

  const fromLabel = span.fromLabel ?? shortYear(span.from);
  const toLabel = span.toLabel ?? shortYear(span.to);
  const fromEnd = x(span.from) + textWidth(fromLabel, SIZE);
  const toStart = x(span.to) - textWidth(toLabel, SIZE);
  let hlY = labelY;
  let hlX = 0;
  if (highlight?.label) {
    const w = textWidth(highlight.label, SIZE);
    hlX = clampX((x(highlight.from) + x(highlight.to)) / 2, highlight.label);
    if (hlX - w / 2 < fromEnd + 8 || hlX + w / 2 > toStart - 8) hlY = labelY + 16;
  }
  const height = hlY + 6;
  const tickX = mark ? x(mark.year) : 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={[
        `${fromLabel} to ${toLabel}`,
        highlight?.label ? `${highlight.label} highlighted` : null,
        mark ? `${mark.label}${mark.note ? `, ${mark.note}` : ""}` : null,
      ]
        .filter(Boolean)
        .join("; ")}
      className={className}
      style={{ overflow: "visible" }}
    >
      <g fontFamily="var(--font-sans)" fontSize={SIZE} className="tabular">
        <rect
          x={x(span.from)}
          y={barY - 3}
          width={x(span.to) - x(span.from)}
          height={6}
          rx={1}
          fill="var(--indigo-wash)"
        />
        {highlight && (
          <rect
            x={x(highlight.from)}
            y={barY - 3}
            width={Math.max(2, x(highlight.to) - x(highlight.from))}
            height={6}
            rx={1}
            fill="var(--indigo-tint)"
          />
        )}
        <text x={x(span.from)} y={labelY} fill="var(--ink-3)">
          {fromLabel}
        </text>
        <text x={x(span.to)} y={labelY} textAnchor="end" fill="var(--ink-3)">
          {toLabel}
        </text>
        {highlight?.label && (
          <text x={hlX} y={hlY} textAnchor="middle" fill="var(--ink-2)">
            {highlight.label}
          </text>
        )}
        {mark && (
          <>
            <line
              x1={tickX}
              x2={tickX}
              y1={barY - 11}
              y2={barY + 6}
              stroke="var(--indigo)"
              strokeWidth={2}
            />
            <text
              x={clampX(tickX, mark.label)}
              y={barY - 15}
              textAnchor="middle"
              fill="var(--ink)"
              fontWeight={600}
            >
              {mark.label}
            </text>
            {mark.note && (
              <text
                x={clampX(tickX, mark.note)}
                y={barY - 29}
                textAnchor="middle"
                fill="var(--ink-3)"
              >
                {mark.note}
              </text>
            )}
          </>
        )}
      </g>
    </svg>
  );
}
