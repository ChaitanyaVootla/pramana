/**
 * A 40×6 px time strip for date chips and chapter rows: where a date (a tick)
 * or a span (a bar) falls within an enclosing span. Server-safe, decorative
 * (aria-hidden): the chip's text carries the meaning.
 *
 *   <TimeStrip within={[-321, -184]} mark={-260} approximate />
 *   <TimeStrip within={[-321, -184]} mark={[-267, -231]} />
 *
 * A mark after the enclosing span shows as a small arrow at the right end
 * ("later", e.g. a chapter about how the sources were read), before it at the left.
 */
export interface TimeStripProps {
  /** The enclosing span, astronomical years [from, to]. */
  within: [number, number];
  /** A year, or a span [from, to], astronomical. */
  mark: number | [number, number];
  /** The mark's date is approximate: the tick gets a soft halo. */
  approximate?: boolean;
  /** Default 40 × 6. */
  width?: number;
  height?: number;
  className?: string;
}

export function TimeStrip({
  within,
  mark,
  approximate = false,
  width = 40,
  height = 6,
  className,
}: TimeStripProps) {
  const [a, b] = within;
  const span = Math.max(1e-6, b - a);
  const x = (y: number) => ((y - a) / span) * width;
  const [m0, m1] = typeof mark === "number" ? [mark, mark] : mark;
  const after = m0 > b;
  const before = m1 < a;
  const isPoint = typeof mark === "number" || x(m1) - x(m0) < 2;
  const cx = Math.min(width - 1, Math.max(1, x((m0 + m1) / 2)));
  const w = Math.max(2, Math.min(width, x(m1)) - Math.max(0, x(m0)));
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={className}
      style={{ overflow: "visible", flexShrink: 0 }}
    >
      <rect width={width} height={height} rx={1} fill="var(--indigo-tint)" fillOpacity={0.55} />
      {after ? (
        <path
          d={`M${width - 1} ${-1} L${width + 4} ${height / 2} L${width - 1} ${height + 1} Z`}
          fill="var(--indigo)"
        />
      ) : before ? (
        <path d={`M1 ${-1} L-4 ${height / 2} L1 ${height + 1} Z`} fill="var(--indigo)" />
      ) : isPoint ? (
        <>
          {approximate && (
            <rect
              x={cx - 3}
              y={0}
              width={6}
              height={height}
              rx={1}
              fill="var(--indigo)"
              fillOpacity={0.25}
            />
          )}
          <rect x={cx - 1} y={-1.5} width={2} height={height + 3} rx={0.5} fill="var(--indigo)" />
        </>
      ) : (
        <rect x={Math.max(0, x(m0))} y={0} width={w} height={height} rx={1} fill="var(--indigo)" />
      )}
    </svg>
  );
}
