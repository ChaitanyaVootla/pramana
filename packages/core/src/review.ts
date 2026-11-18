/**
 * The order to review pending changesets in: each one after the proposals it
 * builds on (dependsOn), oldest first among equals. A proposal is "ready"
 * when nothing it builds on is still waiting; reviewing in this order means
 * every approval can be made on its own, one at a time.
 */
export interface Reviewable {
  id: string;
  dependsOn: string[];
  status: string;
}

export interface ReviewOrder<T extends Reviewable> {
  item: T;
  /** Waiting proposals it builds on, in review order. */
  waitingOn: T[];
  /** Nothing it builds on is still waiting. */
  ready: boolean;
}

export function orderForReview<T extends Reviewable>(all: T[]): ReviewOrder<T>[] {
  const waiting = new Map(all.filter((c) => c.status === "proposed").map((c) => [c.id, c]));
  const out: ReviewOrder<T>[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();
  const visit = (c: T) => {
    if (placed.has(c.id) || visiting.has(c.id)) return;
    visiting.add(c.id);
    for (const d of c.dependsOn) {
      const dep = waiting.get(d);
      if (dep) visit(dep);
    }
    visiting.delete(c.id);
    placed.add(c.id);
    const waitingOn = c.dependsOn.map((d) => waiting.get(d)).filter((d): d is T => Boolean(d));
    out.push({ item: c, waitingOn, ready: waitingOn.length === 0 });
  };
  // Ids are UUIDv7, so sorting by id is sorting by creation time.
  [...waiting.values()].sort((a, b) => a.id.localeCompare(b.id)).forEach(visit);
  return out;
}
