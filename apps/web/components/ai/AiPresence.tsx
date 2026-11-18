"use client";

import type { AskSubject } from "@pramana/core";
import type { NoteView } from "@pramana/services";
import { Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PresenceGlyph } from "@/components/shell/Presence";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AskAi } from "./AskAi";
import { clientLabel } from "./labels";
import { historyHref, useLiveNotes, type NotesScope } from "./live-notes";
import { primaryAsk, usePartner } from "./partner";
import { whenPosted } from "./time";
import { usePresence } from "./usePresence";

/**
 * The study partner in one place (docs/visual.md §7): the presence glyph in the top bar opens a
 * calm popover, in ink with the partner's dotted rule and no chat. It says whether the AI is
 * connected (or how to connect it), shows its last three notes about what is in view, offers the
 * "Ask your AI about this" prompts for what is on screen, and undoes its latest change to this
 * page's view. `initialConnected` is the server-rendered state, shown until the first check.
 */
export function AiPresence({
  initialConnected = false,
  className,
}: {
  initialConnected?: boolean;
  className?: string;
}) {
  const presence = usePresence();
  const connected = presence ? presence.connected : initialConnected;
  const { viewChange } = usePartner();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={connected ? "Your AI: connected" : "Your AI: not connected"}
        className={cn(
          "relative inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 font-sans text-ui text-ink-2 transition-colors hover:bg-rule-soft hover:text-ink data-[popup-open]:bg-rule-soft data-[popup-open]:text-ink",
          className,
        )}
      >
        <PresenceGlyph connected={connected} />
        <span className="hidden sm:inline" aria-hidden>
          AI
        </span>
        {/* The AI changed this page's view and the learner has not decided: a quiet ink dot. */}
        {viewChange && (
          <span className="absolute top-1.5 right-1 size-1.5 rounded-full bg-ink" aria-hidden />
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        aria-label="Your AI"
        className="w-[min(24rem,calc(100vw-1rem))] gap-0 border border-dotted border-ink-3 p-0 font-sans text-ui text-ink"
      >
        <PartnerPanel connected={connected} onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

const ASK_LABEL: Record<AskSubject["type"], string> = {
  claim: "Explain this claim",
  chapter: "Explain this part",
  page: "Give an overview of this page",
  entity: "Tell me about this",
  source: "Tell me about this source",
  canvas: "Look at this canvas",
};

function scopeOf(s: AskSubject | null): NotesScope {
  if (!s) return { recent: true };
  switch (s.type) {
    case "page":
    case "chapter":
      return { pageId: s.page };
    case "entity":
      return { subject: { type: "entity", id: s.entity } };
    default:
      return { subject: { type: s.type, id: s.id } };
  }
}

/** A note's body as one plain line (no Markdown marks or links). */
function plain(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-dotted border-ink-3 px-4 py-3">
      <h2 className="font-sans text-sm font-normal text-ink-3">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function PartnerPanel({ connected, onNavigate }: { connected: boolean; onNavigate: () => void }) {
  const presence = usePresence();
  const { asks, viewChange } = usePartner();
  const primary = primaryAsk(asks);
  const scope = scopeOf(primary);
  const session = presence?.sessions[0];

  return (
    <div>
      <div className="flex items-start gap-2.5 px-4 py-3">
        <PresenceGlyph connected={connected} className="mt-0.5 text-ink-2" />
        {connected ? (
          <p>
            Your AI is connected
            {session ? (
              <span className="text-ink-2">
                {clientLabel(session.client.name) ? `: ${clientLabel(session.client.name)}` : ""}, active{" "}
                {whenPosted(session.lastSeenAt)}
              </span>
            ) : null}
            .
          </p>
        ) : (
          <p>
            Your AI is not connected.{" "}
            <Link
              href="/connect"
              onClick={onNavigate}
              className="text-indigo underline decoration-indigo-tint underline-offset-2 hover:decoration-indigo"
            >
              Connect your AI
            </Link>{" "}
            <span className="text-ink-2">so it can read the evidence and leave notes here.</span>
          </p>
        )}
      </div>

      {viewChange && (
        <Section title="Your AI changed this page for you">
          <p>{viewChange.note ?? "It changed what this page shows."}</p>
          {viewChange.lines.length > 0 && (
            <p className="mt-0.5 text-sm text-ink-2">{viewChange.lines.join("; ")}</p>
          )}
          <div className="mt-2 flex gap-2">
            <Button size="xs" variant="outline" onClick={viewChange.undo}>
              <Undo2 data-icon="inline-start" /> Undo
            </Button>
            <Button size="xs" variant="ghost" onClick={viewChange.keep}>
              Keep it
            </Button>
          </div>
        </Section>
      )}

      <Section title={primary ? `Notes about ${primary.label}` : "Latest notes"}>
        <PartnerNotes scope={scope} connected={connected} onNavigate={onNavigate} />
      </Section>

      {asks.length > 0 && (
        <Section title="Ask your AI">
          <ul className="space-y-1.5">
            {asks.map((s) => (
              <li key={JSON.stringify(s)}>
                <AskAi
                  subject={s}
                  register={false}
                  label={s.type === "entity" ? `Tell me about ${s.label}` : ASK_LABEL[s.type]}
                  detail={s.type === "chapter" || s.type === "claim" ? s.label : undefined}
                  className="w-full justify-start"
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-3">
            Copies a question to paste into your AI. Its answer appears beside the page.
          </p>
        </Section>
      )}
    </div>
  );
}

function PartnerNotes({
  scope,
  connected,
  onNavigate,
}: {
  scope: NotesScope;
  connected: boolean;
  onNavigate: () => void;
}) {
  const { notes, loaded } = useLiveNotes(scope, undefined, 3);
  const shown: NoteView[] = notes.slice(0, 3);
  if (!loaded) return <p className="text-sm text-ink-3">Looking…</p>;
  return (
    <>
      {shown.length === 0 ? (
        <p className="text-ink-2">
          {connected
            ? "None yet. Ask about this below, and the answer appears beside the page."
            : "Once your AI is connected, its notes about this appear here."}
        </p>
      ) : (
        <ol className="space-y-2.5">
          {shown.map((n) => (
            <li key={n.id} className="marginalia">
              <p className="font-medium">{n.title}</p>
              <p className="line-clamp-2 text-sm text-ink-2">{plain(n.body)}</p>
              <p className="text-xs text-ink-3" suppressHydrationWarning>
                {[n.anchorLabel, whenPosted(n.createdAt)].filter(Boolean).join(", ")}
              </p>
            </li>
          ))}
        </ol>
      )}
      <Link
        href={historyHref(scope)}
        onClick={onNavigate}
        className="mt-2 inline-block text-sm text-ink-3 hover:text-ink"
      >
        {notes.length > 3 ? "All notes" : "Notes history"}
      </Link>
    </>
  );
}
