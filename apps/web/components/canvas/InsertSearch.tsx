"use client";

import type { CanvasItemContentInput } from "@pramana/core";
import type { CanvasFind } from "@pramana/services";
import { BookOpen, Heading, Image as ImageIcon, MapPin, Quote, Text } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Command } from "@/components/ui/command";

/**
 * "Add to the board" search, opened with "/" or Cmd-K: claims, people and
 * places, parts of pages and pictures from the site, plus the learner's own
 * text and section cards. Choosing one adds it after the last item.
 */
export function InsertSearch({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (content: CanvasItemContentInput) => void;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<CanvasFind | null>(null);
  // The selected row, ours to set: results arrive after the learner's own rows are drawn, and cmdk would
  // otherwise keep "Text: …" selected, so Enter would make a text card instead of adding what was found.
  const [value, setValue] = useState("own-text");
  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (!query) {
      setFound(null);
      setValue("own-text");
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/canvas/find?q=${encodeURIComponent(query)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<CanvasFind>) : null))
        .then((d) => {
          if (!d) return;
          setFound(d);
          const first = d.claims[0]
            ? `claim-${d.claims[0].id}`
            : d.entities[0]
              ? `entity-${d.entities[0].id}`
              : d.parts[0]
                ? `part-${d.parts[0].page}-${d.parts[0].chapterId}`
                : d.media[0]
                  ? `media-${d.media[0].id}`
                  : "own-text";
          setValue(first);
        })
        .catch(() => {});
    }, 160);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, open]);

  const pick = (content: CanvasItemContentInput) => {
    onInsert(content);
    onOpenChange(false);
    setQ("");
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Add to this canvas" description="Search the site, or add text of your own">
      <Command shouldFilter={false} value={value} onValueChange={setValue}>
        <CommandInput value={q} onValueChange={setQ} placeholder="Search claims, people, places, parts, pictures…" />
        <CommandList className="max-h-[60vh]">
          {q.trim() && found && <CommandEmpty>Nothing on the site matches that yet.</CommandEmpty>}
          {found && found.claims.length > 0 && (
            <CommandGroup heading="Claims">
              {found.claims.map((c) => (
                <CommandItem key={c.id} value={`claim-${c.id}`} onSelect={() => pick({ kind: "claim", claimId: c.id })}>
                  <Quote className="text-indigo" aria-hidden />
                  <span className="line-clamp-2">{c.text}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {found && found.entities.length > 0 && (
            <CommandGroup heading="People, places and events">
              {found.entities.map((e) => (
                <CommandItem key={e.id} value={`entity-${e.id}`} onSelect={() => pick({ kind: "entity", entity: e.id })}>
                  <MapPin className="text-sandstone" aria-hidden />
                  <span>{e.label}</span>
                  {e.whenLabel && <span className="ml-auto text-xs text-ink-3 tnum">{e.whenLabel}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {found && found.parts.length > 0 && (
            <CommandGroup heading="Parts of pages">
              {found.parts.map((p) => (
                <CommandItem
                  key={`${p.page}-${p.chapterId}`}
                  value={`part-${p.page}-${p.chapterId}`}
                  onSelect={() => pick({ kind: "chapter", page: p.page, chapterId: p.chapterId })}
                >
                  <BookOpen className="text-ink-3" aria-hidden />
                  <span>{p.title}</span>
                  <span className="ml-auto truncate text-xs text-ink-3">{p.pageTitle}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {found && found.media.length > 0 && (
            <CommandGroup heading="Pictures">
              {found.media.map((m) => (
                <CommandItem key={m.id} value={`media-${m.id}`} onSelect={() => pick({ kind: "media", mediaId: m.id })}>
                  <ImageIcon className="text-ink-3" aria-hidden />
                  <span>{m.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {/* The learner's own words come after what the site found, so Enter adds the first result. */}
          <CommandGroup heading="Your own">
            <CommandItem value="own-text" onSelect={() => pick({ kind: "text", markdown: q.trim() || "A thought of your own" })}>
              <Text className="text-ink-3" aria-hidden /> {q.trim() ? `Text: “${q.trim()}”` : "A text card"}
            </CommandItem>
            <CommandItem value="own-section" onSelect={() => pick({ kind: "section", title: q.trim() || "New section" })}>
              <Heading className="text-ink-3" aria-hidden /> {q.trim() ? `Section: “${q.trim()}”` : "A section heading"}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
