"use client";

import type { Presence } from "@pramana/services";
import { useSyncExternalStore } from "react";
import { lastLiveEvent, subscribeLiveEvents } from "@/lib/useLiveEvents";

/*
 * Whether the reader's AI is connected: one store per tab, shared by the top
 * bar and every "Ask your AI" button. The live event stream brings it: its
 * "hello" carries the current state and "presence" events every change (the
 * server also notices a session going quiet), so nothing polls. Only if the
 * stream brings nothing within a few seconds is /api/presence fetched once.
 */
let current: Presence | null = null;
const subscribers = new Set<() => void>();
let unlisten: (() => void) | null = null;
let fallback: ReturnType<typeof setTimeout> | null = null;

function set(next: Presence): void {
  current = next;
  for (const s of subscribers) s();
}

async function load(): Promise<void> {
  try {
    const res = await fetch("/api/presence", { cache: "no-store" });
    if (res.ok) set((await res.json()) as Presence);
  } catch {
    // offline: keep the last known state
  }
}

function subscribe(onChange: () => void): () => void {
  subscribers.add(onChange);
  if (subscribers.size === 1) {
    const known = lastLiveEvent("presence")?.presence ?? lastLiveEvent("hello")?.presence;
    if (known) set(known);
    unlisten = subscribeLiveEvents((event) => {
      if ((event.table === "hello" || event.table === "presence") && event.presence) {
        if (fallback) clearTimeout(fallback);
        fallback = null;
        set(event.presence);
      }
    });
    if (!current) fallback = setTimeout(() => void load(), 3000);
  }
  return () => {
    subscribers.delete(onChange);
    if (!subscribers.size) {
      unlisten?.();
      unlisten = null;
      if (fallback) clearTimeout(fallback);
      fallback = null;
    }
  };
}

export function usePresence(): Presence | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
