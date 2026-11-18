"use client";

import type { AskSubject } from "@pramana/core";
import { useEffect, useSyncExternalStore } from "react";

/*
 * What the study partner's popover (PartnerPopover) offers for the page in view. Pages don't
 * declare it: every "Ask your AI about this" button that is on screen registers its subject, and
 * the "Your view" provider registers the AI's latest change to the view, with Undo and Keep. One
 * store per tab; entries leave when their component unmounts.
 */

export interface PartnerViewChange {
  note: string | null;
  lines: string[];
  undo: () => void;
  keep: () => void;
}

interface Snapshot {
  asks: AskSubject[];
  viewChange: PartnerViewChange | null;
}

const asks = new Map<number, AskSubject>();
const changes = new Map<number, PartnerViewChange>();
const listeners = new Set<() => void>();
let snapshot: Snapshot = { asks: [], viewChange: null };
let next = 0;

/** The same thing asked about twice (a page head and its empty state) is offered once. */
function key(s: AskSubject): string {
  return s.type === "chapter" ? `chapter:${s.page}:${s.chapter}` : `${s.type}:${"id" in s ? s.id : s.type === "page" ? s.page : s.entity}`;
}

function publish(): void {
  const seen = new Set<string>();
  const list: AskSubject[] = [];
  for (const s of asks.values()) {
    const k = key(s);
    if (seen.has(k)) continue;
    seen.add(k);
    list.push(s);
  }
  snapshot = { asks: list, viewChange: [...changes.values()].at(-1) ?? null };
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const EMPTY: Snapshot = { asks: [], viewChange: null };

export function usePartner(): Snapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}

/** Offers "ask about this" in the popover while the calling component is mounted. */
export function usePartnerAsk(subject: AskSubject | null): void {
  const k = subject ? JSON.stringify(subject) : null;
  useEffect(() => {
    if (!k) return;
    const id = next++;
    asks.set(id, JSON.parse(k) as AskSubject);
    publish();
    return () => {
      asks.delete(id);
      publish();
    };
  }, [k]);
}

/**
 * Rendered by the "Your view" provider: puts the AI's latest change to this view, with Undo and
 * Keep, in the popover, for as long as it is pending.
 */
export function PartnerViewChange({
  change,
  undo,
  keep,
}: {
  change: { at: string; note?: string | null; lines: string[] } | null | undefined;
  undo: () => void;
  keep: () => void;
}): null {
  const at = change?.at ?? null;
  useEffect(() => {
    if (!change) return;
    const id = next++;
    changes.set(id, { note: change.note ?? null, lines: change.lines, undo, keep });
    publish();
    return () => {
      changes.delete(id);
      publish();
    };
    // Re-registered for a new change (its time) or new handlers.
  }, [at, undo, keep]);
  return null;
}

/** The subject whose notes the popover shows: the page over a canvas over a thing on it. */
export function primaryAsk(list: AskSubject[]): AskSubject | null {
  const order: AskSubject["type"][] = ["page", "canvas", "entity", "source", "claim", "chapter"];
  for (const t of order) {
    const found = list.find((s) => s.type === t);
    if (found) return found;
  }
  return null;
}
