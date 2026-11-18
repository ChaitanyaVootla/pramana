"use client";

import type { PageLearning } from "@pramana/services";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { pageLearningAction } from "@/app/learn/actions";

/**
 * What the learner has answered on a page, shared by every question block on
 * it (a guess at a chapter's start and its reveal at the chapter's end are two
 * blocks). Loaded once per page through a server action, then updated in place
 * from each answer's response, so the blocks need nothing from the page loader.
 */

export type LearningState =
  | { status: "loading"; data: null }
  | { status: "ready"; data: PageLearning }
  | { status: "error"; data: null; error: string };

interface Entry {
  state: LearningState;
  listeners: Set<() => void>;
  loading: boolean;
}

const entries = new Map<string, Entry>();
const LOADING: LearningState = { status: "loading", data: null };

function entry(pageId: string): Entry {
  let e = entries.get(pageId);
  if (!e) {
    e = { state: LOADING, listeners: new Set(), loading: false };
    entries.set(pageId, e);
  }
  return e;
}

function set(pageId: string, state: LearningState) {
  const e = entry(pageId);
  e.state = state;
  e.listeners.forEach((l) => l());
}

function load(pageId: string) {
  const e = entry(pageId);
  if (e.loading || e.state.status === "ready") return;
  e.loading = true;
  pageLearningAction(pageId)
    .then((r) => set(pageId, r.ok ? { status: "ready", data: r.data } : { status: "error", data: null, error: r.error }))
    .catch((error: unknown) => set(pageId, { status: "error", data: null, error: error instanceof Error ? error.message : String(error) }))
    .finally(() => {
      entry(pageId).loading = false;
    });
}

export function usePageLearning(pageId: string) {
  const state = useSyncExternalStore(
    useCallback(
      (cb: () => void) => {
        const e = entry(pageId);
        e.listeners.add(cb);
        return () => e.listeners.delete(cb);
      },
      [pageId],
    ),
    () => entry(pageId).state,
    () => LOADING,
  );
  useEffect(() => load(pageId), [pageId]);
  const update = useCallback(
    (fn: (d: PageLearning) => PageLearning) => {
      const current = entry(pageId).state;
      if (current.status === "ready") set(pageId, { status: "ready", data: fn(current.data) });
    },
    [pageId],
  );
  const retry = useCallback(() => {
    set(pageId, LOADING);
    load(pageId);
  }, [pageId]);
  return { state, update, retry };
}
