"use client";

import type { EntityCard } from "@pramana/services";
import { createContext, useContext } from "react";

/**
 * What a page reader offers the things inside it. Inside a page, claim links
 * open the claim's evidence, places open their card (and frame them on the
 * atlas), and dates can set the atlas year. Elsewhere every field is absent
 * and links simply navigate.
 */
export interface Reader {
  selectClaim?: (id: string) => void;
  selectedClaim?: string | null;
  claimText?: (id: string) => string | undefined;
  entity?: (ref: string) => EntityCard | undefined;
  entityHref?: (ref: string) => string;
  /** The span the page is about, for placing dates in perspective. */
  within?: [number, number] | null;
  /** Open an entity's card beside the reading (and pin it on the atlas). */
  selectEntity?: (id: string) => void;
  selectedEntity?: string | null;
  /** Show the atlas in a year (astronomical). Absent when the page has no atlas. */
  showYear?: (year: number) => void;
  /**
   * Whether a part with a one-minute version is folded (only its brief shows).
   * Its brief is at #brief-<chapterId>. Undefined for parts without a brief.
   */
  partFolded?: (chapterId: string) => boolean | undefined;
  /** Bring the atlas into view (phones, where it sits above the chapters). */
  revealMap?: () => void;
}

export const ReaderContext = createContext<Reader>({});

export function useReader(): Reader {
  return useContext(ReaderContext);
}

export const PLACE_KINDS = new Set(["place", "site", "inscription"]);

/** Places, and events with a location: these open a place card and can be found on the map. */
export function isLocated(entity: Pick<EntityCard, "kind" | "geo">): boolean {
  return PLACE_KINDS.has(entity.kind) || (entity.kind === "event" && entity.geo !== null);
}

/** The place a claim is shown on the page: its list item, else the first prose link to it. */
export function claimElement(id: string, within?: string | null): HTMLElement | null {
  const scope = (within && document.getElementById(within)) || document;
  const found =
    scope.querySelector<HTMLElement>(`#claim-${CSS.escape(id)}`) ??
    scope.querySelector<HTMLElement>(`[data-claim="${CSS.escape(id)}"]`);
  return found ?? (scope === document ? null : claimElement(id));
}
