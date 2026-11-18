import { Check, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Checks on one citation, in plain words. The wording matches the evidence
 * drawer so a reader meets the same sentence at both depths.
 */
export type CheckState = "ok" | "open" | "bad";

export function quoteCheck(status: string, score?: number): { state: CheckState; text: string } {
  switch (status) {
    case "exact":
      return { state: "ok", text: "The quote is exact: found word for word in our stored copy of the source." };
    case "fuzzy":
      return {
        state: "ok",
        text: `Quote found in our stored copy${score ? ` (${Math.round(score * 100)}% match)` : ""}; the scan has small errors.`,
      };
    case "human_attested":
      return { state: "ok", text: "A person checked the quote against the source." };
    case "not_found":
      return { state: "bad", text: "The quote was not found in our stored copy. Treat with caution." };
    case "no_quote":
      return { state: "open", text: "Cited by page only; nobody has checked the wording yet." };
    case "no_snapshot":
      return { state: "open", text: "We have no stored copy of this source to check against." };
    default:
      return { state: "open", text: "Not yet checked." };
  }
}

/** The status to show: "stale" when a judgment no longer applies to the claim as it now stands. */
export function shownSupportStatus(check: { status: string; state?: string }): string {
  return check.state === "stale" ? "stale" : check.status;
}

/**
 * What a citation's words were judged to do, by how they are cited: words cited
 * against a claim are judged on whether they go against it, so a check never
 * reads "supports" beside "contradicts the claim".
 */
export function stanceWords(stance = "supports"): { does: string; partly: string; doesNot: string } {
  if (stance === "contradicts")
    return { does: "go against the claim", partly: "go against only part of the claim", doesNot: "do not go against the claim" };
  if (stance === "qualifies")
    return { does: "qualify the claim", partly: "qualify only part of the claim", doesNot: "do not qualify the claim" };
  return { does: "support the claim", partly: "back only part of the claim", doesNot: "do not support the claim" };
}

export function supportCheck(status: string, stance?: string): { state: CheckState; text: string } {
  const w = stanceWords(stance);
  switch (status) {
    case "stale":
      return { state: "open", text: "An earlier judgment of these words no longer applies: the claim, the quote or how it is cited has changed since." };
    case "human_confirmed":
      return { state: "ok", text: `A person confirmed that these words ${w.does}.` };
    case "human_partial":
      return { state: "ok", text: `A person judged that these words ${w.partly}.` };
    case "human_rejected":
      return { state: "bad", text: `A person judged that these words ${w.doesNot}.` };
    case "ai_supports":
      return { state: "ok", text: `An AI reviewer judged that these words ${w.does} (not yet confirmed by a person).` };
    case "ai_partial":
      return { state: "open", text: `An AI reviewer judged that these words ${w.partly}.` };
    case "ai_unsupported":
      return { state: "bad", text: `An AI reviewer judged that these words ${w.doesNot}.` };
    default:
      return { state: "open", text: `Whether these exact words ${w.does} has not been reviewed yet.` };
  }
}

/** A claim's citations judged together (see ClaimSupportCheck), in plain words. */
export function jointSupportCheck(status: string, stale: boolean): { state: CheckState; text: string } {
  if (stale) {
    return { state: "open", text: "An earlier judgment of these sources together no longer applies: the claim or its sources have changed since." };
  }
  switch (status) {
    case "human_confirmed":
      return { state: "ok", text: "A person confirmed that these sources, read together, support the whole claim." };
    case "human_partial":
      return { state: "open", text: "A person judged that even together these sources only partly support the claim." };
    case "human_rejected":
      return { state: "bad", text: "A person judged that even together these sources do not support the claim." };
    case "ai_supports":
      return { state: "ok", text: "An AI reviewer judged that these sources, read together, support the whole claim (not yet confirmed by a person)." };
    case "ai_partial":
      return { state: "open", text: "An AI reviewer judged that even together these sources only partly support the claim." };
    case "ai_unsupported":
      return { state: "bad", text: "An AI reviewer judged that even together these sources do not support the claim." };
    default:
      return { state: "open", text: "These sources have not been judged together yet." };
  }
}

/** The short form of a citation's support check, for the chain at a glance. */
export function supportNote(status: string, stance?: string): string {
  const w = stanceWords(stance);
  if (status === "stale") return "earlier judgment no longer applies";
  if (status === "human_confirmed" || status === "ai_supports") return `judged to ${w.does}`;
  if (status === "human_partial" || status === "ai_partial") return `judged to ${w.partly}`;
  if (status === "human_rejected" || status === "ai_unsupported") return `judged to ${w.doesNot.replace(/^do not /, "not ")}`;
  return "not yet judged";
}

/** One check as a line: tick, open circle or cross, then the sentence. */
export function CheckLine({ state, children, className }: { state: CheckState; children: React.ReactNode; className?: string }) {
  const Icon = state === "ok" ? Check : state === "bad" ? X : Circle;
  return (
    <p className={cn("flex gap-2 font-sans text-ui", state === "bad" ? "text-madder" : state === "ok" ? "text-ink-2" : "text-ink-3", className)}>
      <Icon
        className={cn("mt-[3px] size-3.5 shrink-0", state === "ok" ? "text-indigo" : state === "bad" ? "text-madder" : "text-ink-3")}
        strokeWidth={state === "ok" ? 2.25 : 1.75}
        aria-hidden
      />
      <span>{children}</span>
    </p>
  );
}

/** Formatted citations use *asterisks* for titles; render them as italics. */
export function Italics({ text }: { text: string }) {
  const parts = text.split(/\*([^*]+)\*/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <em key={i}>{p}</em> : p))}
    </>
  );
}

export const LICENCE_WORDS: Record<string, string> = {
  public_domain: "Public domain",
  open: "Openly licensed",
  copyrighted: "In copyright; quoted briefly, with attribution",
  unknown: "Licence not yet established",
};

export function licenceWords(status: string): string {
  return LICENCE_WORDS[status] ?? status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
