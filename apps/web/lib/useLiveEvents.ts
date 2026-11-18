"use client";

import type { Presence } from "@pramana/services";
import { useEffect, useRef } from "react";

export interface LiveEvent {
  table: string;
  id?: string;
  op?: string;
  /** On "hello" and "presence": whether the reader's AI is connected (see /api/events). */
  presence?: Presence;
  /** On "hello": the version of all notes, to tell whether any were missed while the stream was down. */
  notesVersion?: string;
}

type Listener = (event: LiveEvent) => void;

/*
 * One EventSource per tab, shared by every subscriber (the AI presence, notes
 * panels, a page's own refresh): browsers allow only a few open connections
 * per host, and each tab would otherwise hold several.
 */
const listeners = new Set<Listener>();
let source: EventSource | null = null;
/** The latest "hello" and "presence" events, for subscribers that arrive after them. */
const latest = new Map<string, LiveEvent>();

/** The latest event of a kind ("hello", "presence") this tab has received, if any. */
export function lastLiveEvent(table: "hello" | "presence"): LiveEvent | undefined {
  return latest.get(table);
}
let closing: ReturnType<typeof setTimeout> | null = null;

/** Subscribes outside React (a store shared by a tab); returns the unsubscribe function. */
export function subscribeLiveEvents(listener: Listener): () => void {
  listeners.add(listener);
  if (closing) {
    clearTimeout(closing);
    closing = null;
  }
  if (!source) {
    source = new EventSource("/api/events");
    source.onmessage = (message) => {
      let event: LiveEvent;
      try {
        event = JSON.parse(message.data) as LiveEvent;
      } catch {
        return; // ignore malformed events
      }
      if (event.table === "hello" || event.table === "presence") latest.set(event.table, event);
      for (const l of listeners) l(event);
    };
  }
  return () => {
    listeners.delete(listener);
    // Close a moment later: moving between pages unmounts one subscriber just before the next mounts.
    if (!listeners.size && !closing) {
      closing = setTimeout(() => {
        closing = null;
        if (!listeners.size && source) {
          source.close();
          source = null;
        }
      }, 3000);
    }
  };
}

/** Subscribes to the server's live event stream (Postgres NOTIFY over SSE). Reconnects automatically. */
export function useLiveEvents(onEvent: (event: LiveEvent) => void): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  useEffect(() => subscribeLiveEvents((event) => handler.current(event)), []);
}
