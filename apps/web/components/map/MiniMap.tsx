"use client";

import type { MapFeature } from "@pramana/services";
import { MapCanvas, type MapExtent } from "./MapCanvas";

/** A small, static map for the context rail and place chips. */
export function MiniMap({
  features,
  extents,
  height = 150,
  focusId,
  onPainted,
}: {
  features: MapFeature[];
  extents?: MapExtent[];
  height?: number;
  focusId?: string;
  /** Called once the map has first drawn in full (MapCanvas's onPainted). */
  onPainted?: () => void;
}) {
  return <MapCanvas features={features} extents={extents} height={height} compact focusId={focusId} modernLabels={false} onPainted={onPainted} />;
}
