"use client";

import type { Presence } from "@pramana/services";
import { useState } from "react";
import { PresenceGlyph } from "@/components/shell/Presence";
import { usePresence } from "@/components/ai/usePresence";
import { whenPosted } from "@/components/ai/time";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clientLabel } from "@/components/ai/labels";
import { ASK_CONNECTED } from "./ConnectSetup";

interface Status {
  url: string;
  endpoint: { ok: boolean; tools: number; prompts: number; error?: string };
  presence: Presence;
}

function sentence(presence: Presence | null): string {
  if (!presence) return "Checking whether your AI is connected…";
  if (!presence.connected) return "Your AI is not connected yet. Follow the steps below.";
  const s = presence.sessions[0]!;
  const name = clientLabel(s.client.name);
  const more = presence.sessions.length > 1 ? ` and ${presence.sessions.length - 1} more` : "";
  if (!name && more) return `Your AI is connected in ${presence.sessions.length} places, active ${whenPosted(s.lastSeenAt)}.`;
  return `Your AI is connected${name ? `: ${name}${more}` : ""}, active ${whenPosted(s.lastSeenAt)}.`;
}

/** The connection state as one sentence (docs/visual.md §6), and a check in plain words. */
export function ConnectStatus({ className }: { className?: string }) {
  const presence = usePresence();
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const test = async () => {
    setTesting(true);
    setFailed(null);
    try {
      const res = await fetch("/api/mcp/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`the server answered ${res.status}`);
      setStatus((await res.json()) as Status);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
    } finally {
      setTesting(false);
    }
  };

  const connected = presence?.connected ?? false;
  return (
    <section className={cn("font-sans", className)} aria-labelledby="connect-status">
      <p
        id="connect-status"
        className="flex items-start gap-2.5 text-note text-ink"
        aria-live="polite"
      >
        <PresenceGlyph connected={connected} className="mt-0.5 text-ink-2" />
        <span>{sentence(presence)}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 pl-6.5">
        <Button variant="outline" size="sm" onClick={test} disabled={testing}>
          {testing ? "Checking…" : "Check Pramāṇa is ready"}
        </Button>
        {connected && (
          <span className="text-sm text-ink-3">
            Notes it posts appear beside what they are about.
          </span>
        )}
      </div>
      {(status || failed) && (
        <div className="mt-3 space-y-1.5 pl-6.5 text-ui text-ink-2" aria-live="polite">
          {failed && (
            <p>Pramāṇa did not answer. Check that it is still running, then try again.</p>
          )}
          {status &&
            (!status.endpoint.ok ? (
              <p>
                Pramāṇa is running, but the way in for your AI is not answering. Restart Pramāṇa
                and try again.
              </p>
            ) : connected || status.presence.connected ? (
              <p className="text-ink">Working: your AI can read and study with Pramāṇa.</p>
            ) : (
              <p>
                Pramāṇa is ready for your AI. Set it up below, then ask it: &ldquo;{ASK_CONNECTED}
                &rdquo; This page shows it as connected the moment it answers.
              </p>
            ))}
        </div>
      )}
    </section>
  );
}
