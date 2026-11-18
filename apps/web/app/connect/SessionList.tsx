"use client";

import type { AgentSessionView } from "@pramana/services";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { whenPosted } from "@/components/ai/time";
import { useLiveEvents } from "@/lib/useLiveEvents";
import { EmptyState } from "@/components/ui/empty-state";
import { clientLabel } from "@/components/ai/labels";
import { cn } from "@/lib/utils";

const TRANSPORT: Record<string, string> = {
  http: "through this website",
  stdio: "started by your AI app",
};

/** Recent AI sessions acting for you: what each did, and when it was last active. Live. */
export function SessionList({
  sessions,
  className,
}: {
  sessions: AgentSessionView[];
  className?: string;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveEvents((event) => {
    if (!["sessions", "notes", "changesets"].includes(event.table)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 600);
  });
  // One row per app and day ("Claude Code, 5 connections today"). Groups that wrote nothing, and
  // Pramāṇa's own tasks, fold away, so the list shows what your AI did.
  const groups = groupSessions(sessions);
  const busy = groups.filter((g) => !g.automated && (g.active || g.notes > 0 || g.changesets > 0));
  const quiet = groups.filter((g) => !busy.includes(g));
  return (
    <section className={cn("font-sans", className)} aria-labelledby="sessions-heading">
      <h2 id="sessions-heading" className="font-serif text-xl text-ink">
        Recent connections
      </h2>
      {sessions.length === 0 ? (
        <EmptyState className="mt-3" size="sm" title="No AI has connected yet">
          Follow the steps on this page. Each time your AI connects, it shows here, with what it wrote.
        </EmptyState>
      ) : (
        <>
          {busy.length > 0 ? (
            <Rows groups={busy} />
          ) : (
            <p className="mt-3 text-ui text-ink-2">No recent connection wrote a note or a proposal.</p>
          )}
          {quiet.length > 0 && (
            <details className="mt-3 text-ui text-ink-2">
              <summary className="cursor-pointer">
                {quiet.length} more with nothing written
              </summary>
              <Rows groups={quiet} />
            </details>
          )}
        </>
      )}
    </section>
  );
}

interface Group {
  key: string;
  name: string;
  automated: boolean;
  /** "today", "yesterday" or "18 Oct". */
  day: string;
  count: number;
  transport: string | null;
  notes: number;
  changesets: number;
  active: boolean;
  lastSeenAt: Date;
}

function dayOf(at: Date, now = new Date()): string {
  const d = new Date(at);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= midnight) return "today";
  if (d.getTime() >= midnight - 86_400_000) return "yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Sessions of the same app on the same day, newest first (the list comes newest first). */
function groupSessions(sessions: AgentSessionView[]): Group[] {
  const out = new Map<string, Group>();
  for (const s of sessions) {
    const name = s.automated ? "Pramāṇa's own tasks" : (clientLabel(s.client.name) ?? "Your AI");
    const day = dayOf(s.lastSeenAt);
    const key = `${name}|${day}`;
    const g = out.get(key);
    if (!g) {
      out.set(key, {
        key,
        name,
        automated: s.automated,
        day,
        count: 1,
        transport: s.transport,
        notes: s.notes,
        changesets: s.changesets,
        active: s.active && !s.automated,
        lastSeenAt: new Date(s.lastSeenAt),
      });
      continue;
    }
    g.count += 1;
    g.notes += s.notes;
    g.changesets += s.changesets;
    g.active ||= s.active && !s.automated;
    if (g.transport !== s.transport) g.transport = null;
  }
  return [...out.values()];
}

function Rows({ groups }: { groups: Group[] }) {
  return (
    <ul className="mt-3 divide-y divide-rule border-y border-rule">
      {groups.map((g) => (
        <li
          key={g.key}
          className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-2.5 text-ui"
        >
          <div className="min-w-0">
            <p className="text-ink">
              {g.name}
              {g.active && <span className="ml-2 text-sm text-indigo">connected</span>}
            </p>
            {/* Days and relative times can differ by a moment between server and browser. */}
            <p className="text-sm text-ink-3" suppressHydrationWarning>
              {[
                `${g.count} ${g.count === 1 ? "connection" : "connections"} ${/^\d/.test(g.day) ? `on ${g.day}` : g.day}`,
                g.automated ? "runs by itself" : g.transport ? (TRANSPORT[g.transport] ?? g.transport) : null,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          <div className="text-right text-sm text-ink-3 tnum">
            <p>
              {g.notes} {g.notes === 1 ? "note" : "notes"}, {g.changesets}{" "}
              {g.changesets === 1 ? "proposal" : "proposals"}
            </p>
            <p suppressHydrationWarning>
              {g.active ? "active" : "last active"} {whenPosted(g.lastSeenAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
