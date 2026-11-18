import { looseKey } from "./util";

/** How well a name answers a query: the whole name, a whole alias, a name that starts with it, or a word of it. */
export function nameScore(query: string, label: string, aliases: { label: string }[] = []): number {
  const key = looseKey(label);
  if (key === query) return 3;
  if (aliases.some((a) => looseKey(a.label) === query)) return 2.5;
  if (key.startsWith(query)) return 2;
  if (aliases.some((a) => looseKey(a.label).startsWith(query))) return 1.5;
  if (key.split(" ").some((w) => w.startsWith(query))) return 1;
  return 0;
}

export interface NameCandidate {
  label: string;
  aliases?: { label: string }[] | null;
  /** Full-text rank, from Postgres. */
  rank: number;
  /** How much the site has on it, from 0 to 1: a page about it, pages and claims that name it. */
  prominence?: number;
}

/**
 * Candidates best first: by how well the name answers the query, then (among
 * names that answer it equally, such as "Gupta era" and "Gupta Empire" for
 * "gupta") by how much the site has on each, then by text rank.
 */
export function rankByName<T extends NameCandidate>(query: string, rows: T[]): (T & { name: number })[] {
  return rows
    .map((r) => ({ ...r, name: nameScore(query, r.label, r.aliases ?? []) }))
    .sort((a, b) => b.name - a.name || (b.prominence ?? 0) + b.rank - ((a.prominence ?? 0) + a.rank));
}

/**
 * The candidate the query names, if any: the first ranked one, when the query
 * is its whole name or alias or the start of its name ("chandragupta" for
 * Chandragupta Maurya). A word inside a name ("empire") is not enough.
 */
export function namedMatch<T extends { name: number }>(query: string, ranked: T[]): T | null {
  const first = ranked[0];
  return first && query.length >= 3 && first.name >= 2 ? first : null;
}

/** Prominence from a page about it and the pages and claims that name it, from 0 to 1. */
export function prominenceOf(counts: { subject: boolean; pages: number; claims: number }): number {
  return (counts.subject ? 0.5 : 0) + Math.min(counts.pages, 5) * 0.06 + Math.min(counts.claims, 20) * 0.01;
}
