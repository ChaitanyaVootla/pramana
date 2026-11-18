"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a Vega-Lite spec written by an agent. Specs are data: remote data
 * URLs are stripped (only inline `values` render) so a note cannot make the
 * browser fetch arbitrary resources.
 */

function stripRemote(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripRemote);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "url" || k === "href") continue;
      out[k] = stripRemote(v);
    }
    return out;
  }
  return value;
}

export function VegaView({ spec }: { spec: Record<string, unknown> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let finalize: (() => void) | undefined;
    (async () => {
      try {
        const embed = (await import("vega-embed")).default;
        if (!ref.current) return;
        const safe = {
          width: "container",
          config: {
            font: "Mukta, system-ui, sans-serif",
            range: { category: ["#2733c4", "#c48a00", "#1f7446", "#b93127", "#434869", "#8a8fb5"] },
            mark: { color: "#2733c4" },
            bar: { color: "#2733c4", cornerRadiusEnd: 2 },
            axis: {
              labelColor: "#545b70",
              titleColor: "#1d2340",
              gridColor: "#d6dad3",
              domainColor: "#8a90a0",
            },
            view: { stroke: null },
            background: null,
          },
          ...(stripRemote(spec) as Record<string, unknown>),
        };
        const result = await embed(ref.current, safe as never, { actions: false, renderer: "svg" });
        finalize = () => result.finalize();
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => finalize?.();
  }, [spec]);

  if (error)
    return (
      <p style={{ color: "var(--madder)", fontFamily: "var(--font-sans)" }}>
        This chart could not be drawn: {error}
      </p>
    );
  return <div ref={ref} style={{ width: "100%" }} />;
}
