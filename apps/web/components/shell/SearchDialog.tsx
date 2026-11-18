"use client";

import { BookOpen, Landmark, MapPin, ScrollText, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { EmptyState } from "@/components/ui/empty-state";

// The search dialog itself, loaded on first use (SearchCommand): it brings cmdk.

type EntityResult = {
  id: string;
  slug: string;
  label: string;
  kind: string;
  whenLabel: string | null;
};

interface Results {
  /** The person, place or state the query names; first, and the one Enter opens. */
  match: EntityResult | null;
  pages: { id: string; slug: string; title: string; kind: string }[];
  entities: EntityResult[];
  claims: { id: string; text: string; kind: string; assessment: string }[];
  sources: { id: string; title: string; short: string; tier: string }[];
}

const EMPTY: Results = { match: null, pages: [], entities: [], claims: [], sources: [] };

function entityIcon(kind: string) {
  if (kind === "person") return User;
  if (kind === "place" || kind === "site" || kind === "inscription") return MapPin;
  return Landmark;
}

/** Where Enter goes: the named match, else the first result shown. */
function firstHref(r: Results): string | null {
  const e = r.match ?? null;
  if (e) return `/e/${e.slug}`;
  if (r.pages[0]) return `/p/${r.pages[0].slug}`;
  if (r.entities[0]) return `/e/${r.entities[0].slug}`;
  if (r.claims[0]) return `/c/${r.claims[0].id}`;
  if (r.sources[0]) return `/s/${r.sources[0].id}`;
  return null;
}

/** The ⌘K palette: pages, people, places, claims and sources. Diacritics optional. */
export function SearchDialog({
  open,
  onOpenChange,
  typed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What was typed while this module was loading (and whether Enter was pressed), kept for it. */
  typed?: { text: string; enter: boolean };
}) {
  const [query, setQuery] = useState(typed?.text ?? "");
  const [results, setResults] = useState<Results>(EMPTY);
  // The query the shown results answer; Enter before they catch up waits for them.
  const [answered, setAnswered] = useState("");
  const pendingEnter = useRef(Boolean(typed?.enter && typed.text.trim()));
  const router = useRouter();
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(EMPTY);
      setAnswered("");
      return;
    }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok || n !== seq.current) return;
      const next = (await res.json()) as Results;
      if (pendingEnter.current) {
        pendingEnter.current = false;
        const href = firstHref(next);
        if (href) return go(href);
      }
      setResults(next);
      setAnswered(q);
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    setResults(EMPTY);
    setAnswered("");
    router.push(href);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !query.trim() || answered === query.trim()) return;
    // Typed and pressed Enter before the results arrived: open the first of the new ones.
    e.preventDefault();
    pendingEnter.current = true;
  };

  const match = results.match;
  const entities = match ? results.entities.filter((e) => e.id !== match.id) : results.entities;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search pages, people, places, claims and sources"
    >
      <CommandInput
        placeholder="Try Aśoka, Kalinga or Patna"
        value={query}
        onValueChange={(v) => {
          pendingEnter.current = false;
          setQuery(v);
        }}
        onKeyDown={onInputKey}
      />
      <CommandList className="max-h-[min(60vh,28rem)]">
        {query.trim() && (
          <CommandEmpty className="p-2">
            <EmptyState size="sm" title={`Nothing matches “${query}”.`}>
              Try a shorter word or another spelling; diacritics are optional (asoka finds Aśoka).
            </EmptyState>
          </CommandEmpty>
        )}
        {!query.trim() && (
          <p className="px-3 py-6 text-center font-sans text-sm text-ink-3">
            Type a name, a place or a few words from a claim.
          </p>
        )}
        {/* Keyed by the query answered, so each new set of results starts on its first item. */}
        <Fragment key={answered}>
          {match && (
            <CommandGroup heading="Best match">
              <EntityItem entity={match} onSelect={go} />
            </CommandGroup>
          )}
          {results.pages.length > 0 && (
            <CommandGroup heading="Pages">
              {results.pages.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`page ${p.title}`}
                  onSelect={() => go(`/p/${p.slug}`)}
                >
                  <BookOpen className="text-indigo" />
                  {p.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {entities.length > 0 && (
            <CommandGroup
              heading={match ? "More people, places and periods" : "People, places and periods"}
            >
              {entities.map((e) => (
                <EntityItem key={e.id} entity={e} onSelect={go} />
              ))}
            </CommandGroup>
          )}
          {results.claims.length > 0 && (
            <CommandGroup heading="Claims">
              {results.claims.map((c) => (
                <CommandItem key={c.id} value={`claim ${c.text}`} onSelect={() => go(`/c/${c.id}`)}>
                  <ScrollText className="text-ink-3" />
                  <span className="line-clamp-2 font-serif">{c.text}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results.sources.length > 0 && (
            <CommandGroup heading="Sources">
              {results.sources.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`source ${s.short} ${s.title}`}
                  onSelect={() => go(`/s/${s.id}`)}
                >
                  <Landmark className="text-ink-3" />
                  <span>{s.short}</span>
                  <span className="ml-2 truncate text-xs text-ink-3">{s.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </Fragment>
      </CommandList>
    </CommandDialog>
  );
}

function EntityItem({
  entity: e,
  onSelect,
}: {
  entity: EntityResult;
  onSelect: (href: string) => void;
}) {
  const Icon = entityIcon(e.kind);
  return (
    <CommandItem value={`entity ${e.label} ${e.slug}`} onSelect={() => onSelect(`/e/${e.slug}`)}>
      <Icon
        className={e.kind === "place" || e.kind === "site" ? "text-sandstone" : "text-indigo"}
      />
      <span className="min-w-0 flex-1 truncate">{e.label}</span>
      {e.whenLabel && <span className="shrink-0 text-xs text-ink-3 tnum">{e.whenLabel}</span>}
    </CommandItem>
  );
}
