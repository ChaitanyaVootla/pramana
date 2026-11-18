"use client";

import { uuidv7, type QueuedReviewInput, type Sureness } from "@pramana/core";
import type { StudyCard } from "@pramana/services";
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Offline study. The cards due over the next days are kept on the device
 * (IndexedDB, and the service worker's copy of /api/study/due); answers go
 * into a queue with an idempotency key and the time they were given, and are
 * sent to /api/study/reviews whenever there is a connection. The server
 * records each key once and schedules from the time of answering.
 */

const DB = "pramana-study";
const QUEUE = "queue";
const KV = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    t.onerror = () => reject(t.error);
  });
}

export interface DuePayload {
  generatedAt: string;
  until: string;
  cards: (Omit<StudyCard, "due"> & { due: string })[];
}

/** Answers the learner gave on this device, by key, including ones already sent (kept a day, to hide answered cards). */
interface QueuedAnswer extends QueuedReviewInput {
  sent: boolean;
}

// ---------------------------------------------------------------- state

let pending = 0;
let online = typeof navigator === "undefined" ? true : navigator.onLine;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => (listeners.add(cb), () => listeners.delete(cb));

async function refreshCount() {
  const all = ((await tx<QueuedAnswer[]>(QUEUE, "readonly", (s) => s.getAll())) ?? []).filter(
    (a) => !a.sent,
  );
  pending = all.length;
  emit();
}

/** Whether the browser is offline, and how many answers wait to be sent. */
export function useOfflineStudy(): { offline: boolean; pending: number } {
  const state = useSyncExternalStore(
    subscribe,
    () => `${online ? 1 : 0}|${pending}`,
    () => "1|0",
  );
  const [o, p] = state.split("|");
  return { offline: o === "0", pending: Number(p) };
}

// ---------------------------------------------------------------- queue

/** Queues an answer and tries to send it at once. Returns the server's next due date when it was sent. */
export async function answer(input: {
  claimId: string;
  correct: boolean;
  sureness: Sureness;
  easy?: boolean;
}): Promise<{ sent: boolean; nextDue?: Date }> {
  const item: QueuedAnswer = {
    key: uuidv7(),
    answeredAt: new Date().toISOString(),
    ...input,
    sent: false,
  };
  await tx(QUEUE, "readwrite", (s) => s.put(item));
  await refreshCount();
  const results = await flush();
  const mine = results?.find((r) => r.key === item.key);
  return mine && (mine.status === "recorded" || mine.status === "duplicate")
    ? { sent: true, ...(mine.nextDue ? { nextDue: new Date(mine.nextDue) } : {}) }
    : { sent: false };
}

let flushing: Promise<{ key: string; status: string; nextDue?: string }[] | null> | null = null;

/** Sends every unsent answer. Safe to call often: one send at a time, and the server ignores keys it has seen. */
export function flush() {
  flushing ??= (async () => {
    try {
      const unsent = (
        (await tx<QueuedAnswer[]>(QUEUE, "readonly", (s) => s.getAll())) ?? []
      ).filter((a) => !a.sent);
      if (!unsent.length) return [];
      const res = await fetch("/api/study/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: unsent.map(({ sent: _sent, ...r }) => r) }),
      });
      if (!res.ok) return null;
      const { results } = (await res.json()) as {
        results: { key: string; status: string; nextDue?: string }[];
      };
      const done = new Set(results.filter((r) => r.status !== "refused").map((r) => r.key));
      const refused = new Set(results.filter((r) => r.status === "refused").map((r) => r.key));
      await tx(QUEUE, "readwrite", (s) => {
        for (const a of unsent) {
          if (refused.has(a.key)) s.delete(a.key);
          else if (done.has(a.key)) s.put({ ...a, sent: true });
        }
      });
      online = true;
      return results;
    } catch {
      return null;
    } finally {
      await refreshCount();
      flushing = null;
    }
  })();
  return flushing;
}

// ---------------------------------------------------------------- cards

/** Fetches the cards due over the next days and keeps them on the device. */
export async function saveDue(days = 3): Promise<void> {
  try {
    const res = await fetch(`/api/study/due?days=${days}`);
    if (!res.ok) return;
    const payload = (await res.json()) as DuePayload;
    await tx(KV, "readwrite", (s) => s.put(payload, "due"));
  } catch {
    // Offline: keep the last copy.
  }
}

/**
 * The cards to study now from the copy on the device: due by now, and not
 * already answered here since the copy was made.
 */
export async function savedCards(): Promise<StudyCard[] | null> {
  const payload = await tx<DuePayload>(KV, "readonly", (s) => s.get("due"));
  if (!payload) return null;
  const answered = ((await tx<QueuedAnswer[]>(QUEUE, "readonly", (s) => s.getAll())) ?? []).filter(
    (a) => a.answeredAt >= payload.generatedAt,
  );
  const done = new Set(answered.map((a) => a.claimId));
  const now = new Date();
  return payload.cards
    .map((c) => ({ ...c, due: new Date(c.due) }))
    .filter((c) => c.due <= now && !done.has(c.claimId));
}

/** Forgets answers that were sent more than a day ago. */
async function prune() {
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  await tx(QUEUE, "readwrite", (s) => {
    const req = s.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return;
      const a = cur.value as QueuedAnswer;
      if (a.sent && a.answeredAt < dayAgo) cur.delete();
      cur.continue();
    };
  });
}

/**
 * Mount once on /learn: registers the service worker (scope: read and study
 * only, see public/sw.js), keeps the next days' cards on the device, and sends
 * queued answers when the connection returns.
 */
export function useOfflineSetup(): void {
  useEffect(() => {
    if (!("indexedDB" in window)) return;
    const goOnline = () => {
      online = true;
      emit();
      flush().then(() => saveDue());
    };
    const goOffline = () => {
      online = false;
      emit();
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    online = navigator.onLine;
    if ("serviceWorker" in navigator) {
      const mode = process.env.NODE_ENV === "production" ? "" : "?mode=dev";
      navigator.serviceWorker.register(`/sw.js${mode}`, { scope: "/" }).catch(() => undefined);
    }
    (online ? flush().then(() => saveDue()) : refreshCount()).then(prune).catch(() => undefined);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
}

/**
 * The cards a session starts with: the server's, or, when the page was opened
 * offline (from the service worker's copy), the cards due now from the copy on
 * the device. `source` changes when the device's copy takes over.
 */
export function useStudyCards(fromServer: StudyCard[]): {
  cards: StudyCard[];
  source: "server" | "device";
} {
  const [state, setState] = useState<{ cards: StudyCard[]; source: "server" | "device" }>({
    cards: fromServer,
    source: "server",
  });
  useEffect(() => {
    if (navigator.onLine || !("indexedDB" in window)) return;
    savedCards()
      .then((cards) => cards && setState({ cards, source: "device" }))
      .catch(() => undefined);
  }, []);
  return state;
}
