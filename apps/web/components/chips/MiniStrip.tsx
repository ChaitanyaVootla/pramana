import type { DateBounds } from "@pramana/core";

/**
 * A tiny time strip for chips and hover cards: the enclosing span as a tinted
 * bar, the date or span marked on it. Approximate spans fade at their ends.
 */
export function MiniStrip({
  within,
  bounds,
  width = 40,
}: {
  within: [number, number];
  bounds: DateBounds;
  width?: number;
}) {
  const [a, b] = within;
  const span = b - a || 1;
  const x = (v: number) => Math.max(0, Math.min(width, ((v - a) / span) * width));
  const start = bounds.startMin ?? bounds.endMax ?? a;
  const end = bounds.endMax ?? start + 1;
  const x0 = x(start);
  const x1 = Math.max(x0 + 2, x(end));
  const isPoint = x1 - x0 <= 2.5;
  return (
    <svg
      width={width}
      height={10}
      viewBox={`0 0 ${width} 10`}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <rect x={0} y={2} width={width} height={6} rx={1} fill="var(--indigo-tint)" />
      {isPoint ? (
        <rect x={x0 - 1} y={0} width={2} height={10} fill="var(--indigo)" />
      ) : (
        <rect
          x={x0}
          y={2}
          width={x1 - x0}
          height={6}
          rx={1}
          fill="var(--indigo)"
          opacity={bounds.approximate ? 0.7 : 1}
        />
      )}
    </svg>
  );
}
