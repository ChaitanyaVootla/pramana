"use client";

import type { AtlasExtent } from "@pramana/services";
import { ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { shortYear } from "@/lib/time";

/** A state (or culture area) the atlas has borders for, at its largest. */
export interface Polity {
  key: string;
  name: string;
  /** Its largest drawn extent. */
  peak: AtlasExtent;
  from: number;
  to: number;
}

/** States by their entity, or their name when they have none, each with its largest extent. */
export function politiesOf(pool: AtlasExtent[]): Polity[] {
  const by = new Map<string, Polity>();
  for (const e of pool) {
    const key = e.entityId ?? `name:${e.name}`;
    const cur = by.get(key);
    if (!cur) {
      by.set(key, { key, name: e.name, peak: e, from: e.fromYear, to: e.toYear });
      continue;
    }
    cur.from = Math.min(cur.from, e.fromYear);
    cur.to = Math.max(cur.to, e.toYear);
    if ((e.areaKm2 ?? 0) > (cur.peak.areaKm2 ?? 0)) {
      cur.peak = e;
      cur.name = e.name;
    }
  }
  return [...by.values()].sort((a, b) => a.from - b.from || a.name.localeCompare(b.name));
}

/** Without accents or case: "Maurya" finds "Maurya Empire", "satavahana" "Sātavāhana". */
function plain(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Comparing, two ways: this year with another (its borders stay as a dotted
 * outline while the year moves), or two states, each at its largest, drawn
 * together whatever their years.
 */
export function ComparePanel({
  year,
  near,
  polities,
  pair,
  onPair,
  onKeepYear,
  onClose,
  loading,
}: {
  year: number;
  /** The years this map covers: states within them are listed first. */
  near: [number, number];
  polities: Polity[];
  pair: [string | null, string | null];
  onPair: (pair: [string | null, string | null]) => void;
  onKeepYear: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const pick = (i: 0 | 1, label: string) => (
    <PolityPicker
      label={label}
      placeholder={i === 0 ? "Choose a state" : "and another"}
      value={pair[i]}
      other={pair[i === 0 ? 1 : 0]}
      polities={polities}
      near={near}
      loading={loading}
      onChange={(key) => {
        const next: [string | null, string | null] = [...pair];
        next[i] = key;
        onPair(next);
      }}
    />
  );
  return (
    <div
      role="group"
      aria-label="Compare"
      className="relative mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-rule py-2 pr-8 text-xs text-ink-2"
    >
      <span className="text-ink">Two states, each at its largest:</span>
      {pick(0, "First state")}
      {pick(1, "Second state")}
      {loading && <span className="text-ink-3">Loading every state’s borders…</span>}
      <span className="text-ink-3">or</span>
      <Button variant="outline" size="xs" onClick={onKeepYear}>
        Keep {shortYear(year)}, then move the year
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        // In the corner, so on a phone it never wraps onto a row of its own.
        className="absolute top-1.5 right-0 text-ink-3"
        aria-label="Close compare"
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  );
}

/** A state chosen by typing its name: those of the map's years first, then every other. */
function PolityPicker({
  label,
  placeholder,
  value,
  other,
  polities,
  near,
  loading,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  /** The state chosen in the other box, which can't be chosen twice. */
  other: string | null;
  polities: Polity[];
  near: [number, number];
  loading: boolean;
  onChange: (key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const chosen = polities.find((p) => p.key === value);
  const q = plain(query.trim());
  const shown = q ? polities.filter((p) => plain(p.name).includes(q)) : polities;
  const inYears = (p: Polity) => p.to >= near[0] && p.from <= near[1];
  const groups = [
    { heading: "In these years", items: shown.filter(inYears) },
    { heading: "Other times", items: shown.filter((p) => !inYears(p)) },
  ].filter((g) => g.items.length);
  const item = (p: Polity) => (
    <CommandItem
      key={p.key}
      value={p.key}
      disabled={p.key === other}
      data-checked={p.key === value ? "true" : undefined}
      onSelect={() => {
        onChange(p.key);
        setOpen(false);
        setQuery("");
      }}
      className="min-h-8 py-1.5 text-sm"
    >
      <span className="min-w-0 flex-1 truncate">{p.name}</span>
      <span className="shrink-0 text-xs text-ink-3 tabular">
        {shortYear(p.from)} to {shortYear(p.to)}
      </span>
    </CommandItem>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<button type="button" />}
        className="inline-flex h-7 max-w-[15rem] min-w-0 items-center gap-1 rounded-sm border border-rule bg-paper px-1.5 text-xs text-ink hover:border-ink-3/60"
      >
        {/* Named by its label and what it shows, so the visible words are in its name. */}
        <span className="visually-hidden">{label}: </span>
        <span className={chosen ? "truncate" : "truncate text-ink-3"}>
          {chosen ? chosen.name : placeholder}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-ink-3" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        aria-label={label}
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-0"
      >
        <Command shouldFilter={false} loop>
          <CommandInput placeholder="Type a state’s name" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[min(50vh,20rem)]">
            <CommandEmpty className="px-3 py-4 text-sm text-ink-3">
              {loading ? "Still loading every state…" : "No state by that name has borders drawn."}
            </CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.heading} heading={g.heading}>
                {g.items.map(item)}
              </CommandGroup>
            ))}
          </CommandList>
          {value && (
            <div className="border-t border-rule p-1">
              <Button
                variant="ghost"
                size="xs"
                className="w-full justify-start text-ink-3"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Clear this choice
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
