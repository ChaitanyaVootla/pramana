"use client";

import type { VizSpec } from "@pramana/core";
import type { TimelineItem, VizData } from "@pramana/services";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PeriodTimeline } from "./time/PeriodTimeline";

const HistoryMap = dynamic(() => import("./map/HistoryMap").then((m) => m.HistoryMap), {
  ssr: false,
  loading: () => <div className="h-[460px] rounded-md bg-rule-soft" />,
});
const VegaView = dynamic(() => import("./VegaView").then((m) => m.VegaView), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-md bg-rule-soft" />,
});

/**
 * A Vega-Lite chart, loaded only when it comes within 300px of the screen:
 * the charting library is large, and most readers never reach most charts.
 * Its height is reserved from the start so nothing moves when it arrives.
 */
function LazyVega({ spec }: { spec: Record<string, unknown> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  // The plot's own height plus room for axes and title.
  const plot = typeof spec.height === "number" ? spec.height : 200;
  return (
    <div ref={ref} style={{ minHeight: plot + 60 }}>
      {near ? (
        <VegaView spec={spec} />
      ) : (
        <div className="rounded-md bg-rule-soft" style={{ height: plot + 60 }} aria-hidden />
      )}
    </div>
  );
}

/** Renders any VizSpec (from a page block or an agent's note) with its server-resolved data. */
export function Viz({
  spec,
  data,
  focusId,
}: {
  spec: VizSpec;
  data?: VizData | null;
  focusId?: string;
}) {
  switch (spec.kind) {
    case "timeline":
      return <TimelineViz items={data?.kind === "timeline" ? data.items : []} focusId={focusId} />;
    case "map":
      return (
        <HistoryMap
          features={data?.kind === "map" ? data.features : []}
          extents={data?.kind === "map" ? data.extents : undefined}
          focusEntityId={focusId}
        />
      );
    case "vega-lite":
      return <LazyVega spec={spec.spec as Record<string, unknown>} />;
    case "table":
      return (
        <div className="overflow-x-auto rounded-md border border-rule">
          <Table className="font-sans text-ui">
            <TableHeader>
              <TableRow>
                {spec.columns.map((c) => (
                  <TableHead key={c} className="font-semibold text-ink">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {spec.rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j} className="align-top whitespace-normal text-ink-2">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    case "lineage":
      return (
        <p className="font-sans text-ui">
          <Link href={`/c/${spec.claimId}`} className="text-indigo underline underline-offset-3">
            See where this claim comes from
          </Link>
        </p>
      );
  }
}

/** A timeline block: opens on the span of its own items. */
function TimelineViz({ items, focusId }: { items: TimelineItem[]; focusId?: string }) {
  const starts = items.map((i) => i.bounds.startMin ?? i.bounds.startMax ?? i.bounds.endMin);
  const ends = items.map((i) => i.bounds.endMax ?? i.bounds.endMin ?? i.bounds.startMax);
  const lo = Math.min(...starts.filter((v): v is number => v !== null));
  const hi = Math.max(...ends.filter((v): v is number => v !== null));
  if (!items.length || !Number.isFinite(lo) || !Number.isFinite(hi)) {
    return <p className="font-sans text-ui text-ink-3">Nothing dated to show yet.</p>;
  }
  return (
    <PeriodTimeline
      items={items}
      focus={{ from: lo, to: Math.max(hi, lo + 1), id: focusId, label: "this period" }}
      height={260}
    />
  );
}
