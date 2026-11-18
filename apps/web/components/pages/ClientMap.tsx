"use client";

import dynamic from "next/dynamic";

/** The mini-map, loaded in the browser only (MapLibre needs a canvas). Server pages render this. */
export const ClientMiniMap = dynamic(() => import("@/components/map/MiniMap").then((m) => m.MiniMap), {
  ssr: false,
  loading: () => <div className="h-full min-h-[150px] w-full rounded-md bg-rule-soft" />,
});
