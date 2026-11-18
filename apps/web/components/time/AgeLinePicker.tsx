"use client";

import { useState } from "react";
import type { AtlasStart } from "@/components/atlas/start-years";
import { useAtlasActions, useAtlasBus } from "@/components/atlas/bus";
import type { Age } from "@/components/home/AgesExplorer";
import { AgeLine } from "./AgeLine";

/**
 * The AgeLine as the map's one time control, for pages with no single subject
 * (/timeline, /places): a click on an age moves the map to it (the year its
 * own map opens on, else its start), the lit age is the one the map's year is
 * in, and the label under it opens that age's page. Inside the AtlasProvider.
 */
export function AgeLinePicker({
  ages,
  starts,
  range,
  className,
}: {
  ages: Age[];
  /** Each era page's opening year (eraStarts). */
  starts: AtlasStart[];
  /** The years the map can show: ages outside them stay links. */
  range: [number, number];
  className?: string;
}) {
  const { year } = useAtlasBus();
  const { setYear } = useAtlasActions();
  // The age last picked stays lit while the year is within it (ages overlap: the Mauryas and the
  // Mahājanapadas); otherwise the latest-starting age the year is in, a written one first.
  const [picked, setPicked] = useState<string | null>(null);
  const within = (a: Age) => year !== null && a.from <= year && year <= a.to;
  const lit =
    ages.find((a) => a.id === picked && within(a)) ??
    [...ages]
      .filter(within)
      .sort((a, b) => Number(Boolean(b.page)) - Number(Boolean(a.page)) || b.from - a.from)[0] ??
    null;
  const canPick = (a: Age) => a.to >= range[0] && a.from <= range[1];
  const onPick = (a: Age) => {
    const opens = starts.find((s) => s.pageSlug === a.page?.slug)?.year;
    const y = Math.min(range[1], Math.max(range[0], opens ?? a.from, a.from));
    setPicked(a.id);
    setYear(Math.min(y, a.to), { fromReader: true });
  };
  const common = { ages, focus: lit?.id ?? null, onPick, canPick };
  return (
    <div className={className}>
      <AgeLine {...common} className="hidden sm:block" />
      <AgeLine {...common} size="compact" className="sm:hidden" />
    </div>
  );
}
