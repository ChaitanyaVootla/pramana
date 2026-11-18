"use client";

import type { ClaimCard, EntityCard } from "@pramana/services";
import { formatYear } from "@pramana/core";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Map as MapIcon,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { addToDeckAction } from "@/app/actions";
import { AskAi } from "@/components/ai/AskAi";
import { AddToCanvas } from "@/components/canvas/AddToCanvas";
import { HighlightButtons, YourClaimNote, YourNoteButton } from "@/components/yourview/Customise";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { claimTier, otherNames } from "@/lib/era";
import {
  ASSESSMENT_LABELS,
  ISSUE_PLAIN,
  LENS_LABELS,
  STANCE_LABELS,
  assessmentTone,
} from "@/lib/labels";
import { stanceWords } from "@/components/pages/checks";
import { cn } from "@/lib/utils";
import { EvidenceSeal, sealWords } from "./EvidenceSeal";

const QUOTE_OK = new Set(["exact", "fuzzy", "human_attested"]);

/** The quote check, in words a reader can act on. Shared with the lineage pages. */
export function quoteCheckWords(status: string, score?: number): { ok: boolean; text: string } {
  switch (status) {
    case "exact":
      return { ok: true, text: "The quote is exact: found word for word in our stored copy of the source." };
    case "fuzzy":
      return {
        ok: true,
        text: `Quote found in our stored copy${score ? ` (${Math.round(score * 100)}% match)` : ""}; the scan has small errors.`,
      };
    case "human_attested":
      return { ok: true, text: "A person checked the quote against the source." };
    case "not_found":
      return { ok: false, text: "The quote was not found in our stored copy. Treat with caution." };
    case "no_quote":
      return { ok: false, text: "Cited by page only; nobody has checked the wording yet." };
    case "no_snapshot":
      return { ok: false, text: "We have no stored copy of this source to check against." };
    default:
      return { ok: false, text: "Not yet checked." };
  }
}

/**
 * The support check, in words. Whether the words are quoted exactly and whether
 * they back the claim are two questions: after a quote found in the source
 * (`quoteFound`), a partial verdict says "but", so the two never read as a
 * contradiction. Words cited against the claim are judged on that (`stance`).
 */
export function supportCheckWords(status: string, quoteFound = false, stance?: string): { ok: boolean; text: string } {
  const w = stanceWords(stance);
  switch (status) {
    case "stale":
      return {
        ok: false,
        text: "An earlier judgment of these words no longer applies: the claim, the quote or how it is cited has changed since.",
      };
    case "human_confirmed":
      return { ok: true, text: `A person confirmed that these words ${w.does}.` };
    case "human_partial":
      return {
        ok: true,
        text: quoteFound ? `But the words ${w.partly}, a person judged.` : `A person judged that these words ${w.partly}.`,
      };
    case "human_rejected":
      return { ok: false, text: `A person judged that these words ${w.doesNot}.` };
    case "ai_supports":
      return { ok: true, text: `An AI reviewer judged that these words ${w.does} (not yet confirmed by a person).` };
    case "ai_partial":
      return {
        ok: false,
        text: quoteFound ? `But the words ${w.partly}, an AI reviewer judged.` : `An AI reviewer judged that these words ${w.partly}.`,
      };
    case "ai_unsupported":
      return { ok: false, text: `An AI reviewer judged that these words ${w.doesNot}.` };
    default:
      return { ok: false, text: `Whether these exact words ${w.does} has not been reviewed yet.` };
  }
}

/** "Aśoka, Rock Edict XIII (Kālsī). English by E. Hultzsch, 1925, p. 47." */
function plainCitation(c: ClaimCard["citations"][number]): string {
  const s = c.excerpt.source;
  const loc = c.excerpt.locatorLabel;
  return `${s.short}${loc ? `, ${loc}` : ""}`;
}

/** What kind of source, as a newcomer would say it. */
const TIER_PLAIN: Record<string, string> = {
  primary: "a source from the time",
  secondary: "modern scholarship",
  tertiary: "an encyclopedia",
};

/** How far the words were judged to do what they are cited for, briefly. */
function supportPlain(status: string, stance?: string): string | undefined {
  const w = stanceWords(stance);
  // "they support the claim" said of one quotation: "it supports the claim".
  const one = (v: string) => v.replace(/^(\w+)/, (verb) => (verb === "do" ? "does" : verb === "go" ? "goes" : verb.endsWith("y") ? `${verb.slice(0, -1)}ies` : `${verb}s`));
  return {
    human_confirmed: `a person confirmed it ${one(w.does)}`,
    human_partial: `a person judged it ${one(w.partly)}`,
    human_rejected: `a person judged it ${one(w.doesNot)}`,
    ai_supports: `an AI reviewer judged it ${one(w.does)}`,
    ai_partial: `an AI reviewer judged it ${one(w.partly)}`,
    ai_unsupported: `an AI reviewer judged it ${one(w.doesNot)}`,
    stale: "an earlier review no longer applies",
  }[status];
}

/**
 * The evidence in one plain sentence, before the detail:
 * "From Wikipedia, an encyclopedia; an AI reviewer judged it backs only part of the claim."
 */
function evidenceHeadline(evidential: ClaimCard["citations"]): string | null {
  const first = evidential[0];
  if (!first) return null;
  const s = first.excerpt.source;
  const kinds = [...new Set(evidential.map((c) => c.excerpt.source.tier))];
  const from =
    evidential.length === 1
      ? `From ${s.short}, ${TIER_PLAIN[s.tier] ?? "a source"}`
      : `From ${evidential.length} sources${kinds.includes("primary") ? ", including one from the time" : ""}`;
  const verdict =
    evidential.length === 1
      ? supportPlain(first.supportCheck.state === "stale" ? "stale" : first.supportCheck.status, first.stance)
      : null;
  return `${from}${verdict ? `; ${verdict}` : ""}.`;
}

const TIER_SENTENCE: Record<string, string> = {
  primary: "A source from the time: written when it happened or soon after.",
  secondary: "Modern scholarship.",
  tertiary: "An encyclopedia: good for finding sources, weak as evidence on its own.",
};

export function EvidenceDrawer({
  claim,
  position,
  onClose,
  onStep,
  focusOnOpen = false,
  people = [],
  mapYear = null,
}: {
  claim: ClaimCard;
  /** The claim's people, so a quotation that names them otherwise can say who is meant. */
  people?: EntityCard[];
  position?: { index: number; total: number; chapter: string } | null;
  onClose: () => void;
  onStep?: (delta: 1 | -1) => void;
  /** Move keyboard focus to the claim when it opens (beside the page, where nothing else moves it). */
  focusOnOpen?: boolean;
  /** The year the map moved to when this claim was opened, so the move is said, not silent. */
  mapYear?: number | null;
}) {
  const [pending, start] = useTransition();
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnOpen) titleRef.current?.focus({ preventScroll: true });
  }, [focusOnOpen, claim.id]);
  const tone = assessmentTone(claim.assessment, claim.kind);
  const evidential = claim.citations.filter((c) => c.stance !== "mentions");
  const mentions = claim.citations.filter((c) => c.stance === "mentions");

  return (
    <section
      role="region"
      aria-label={`Evidence for: ${claim.text}`}
      className="font-sans text-note"
    >
      <div className="-mx-1 flex items-center gap-1 text-sm text-ink-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-ink-2">
          <ChevronLeft data-icon="inline-start" /> Context
        </Button>
        {position && (
          <span className="truncate tnum">
            Claim {position.index + 1} of {position.total}
          </span>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          {onStep && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onStep(-1)}
                aria-label="Previous claim"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onStep(1)}
                aria-label="Next claim"
              >
                <ChevronRight />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close evidence">
            <X />
          </Button>
        </span>
      </div>

      <h2
        ref={titleRef}
        tabIndex={-1}
        className="mt-4 rounded-sm font-serif text-lg leading-[1.45] font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {claim.text}
      </h2>
      {evidenceHeadline(evidential) && (
        <p className="mt-2 font-sans text-note leading-snug text-ink-2">
          {evidenceHeadline(evidential)}
        </p>
      )}
      {/* The caution comes before the evidence, where a short panel cannot cut it off. */}
      {claim.assessmentNote && (
        <div className="mt-3 border-l-2 border-turmeric/70 py-0.5 pl-3.5 text-ink-2">
          <span className="font-semibold">Read with care. </span>
          {claim.assessmentNote}
        </div>
      )}
      <p aria-live="polite" className="empty:hidden">
        {mapYear !== null && (
          <span className="mt-1.5 flex items-center gap-1.5 font-sans text-sm text-indigo">
            <MapIcon className="size-3.5" aria-hidden /> The map now shows {formatYear(mapYear)},
            the claim&apos;s date.
          </span>
        )}
      </p>
      {/* "Rests on" would be wrong for a popular belief, whose sources go against it. */}
      <h3 className="mt-4 font-sans text-sm font-semibold text-ink">
        {evidential.every((c) => c.stance === "supports") ? "The words it rests on" : "What the sources say"}
      </h3>
      {evidential.length === 0 && (
        <p className="mt-1.5 text-madder">No source cited yet. Treat this as unverified.</p>
      )}
      <ol className="mt-2.5 space-y-3">
        {evidential.map((c) => {
          const q = quoteCheckWords(c.excerpt.verification.status, c.excerpt.verification.score);
          const sc = supportCheckWords(
            c.supportCheck.state === "stale" ? "stale" : c.supportCheck.status,
            q.ok,
            c.stance,
          );
          return (
            <li
              key={c.id}
              className={cn(
                "rounded-lg border-l-[3px] bg-chuna py-3 pr-3.5 pl-3.5",
                c.stance === "contradicts"
                  ? "border-madder"
                  : c.stance === "qualifies"
                    ? "border-turmeric"
                    : "border-indigo",
              )}
            >
              {c.stance !== "supports" && (
                <p className="mb-1 text-xs font-medium text-ink-3">
                  {STANCE_LABELS[c.stance]} the claim
                </p>
              )}
              {c.excerpt.quote ? (
                <blockquote className="font-serif text-note leading-[1.5] text-ink italic">
                  “{c.excerpt.quote}”
                </blockquote>
              ) : (
                <p className="text-ink-2">Cited by page; no quotation recorded.</p>
              )}
              {c.excerpt.quote &&
                otherNames(c.excerpt.quote, people).map((n) => (
                  <p key={n.label} className="mt-1.5 text-sm text-ink-2">
                    {n.label} is also known as <span lang={n.lang}>{n.alias}</span>. {n.note}
                  </p>
                ))}
              {c.excerpt.original && (
                <p className="mt-1.5 font-serif text-ink-2" lang={c.excerpt.original.lang}>
                  {c.excerpt.original.text}
                </p>
              )}
              <p className="mt-2 text-sm text-ink-2">
                <Link
                  href={`/s/${c.excerpt.source.id}`}
                  className="text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo"
                >
                  {plainCitation(c)}
                </Link>
              </p>
              <p className="text-xs text-ink-3">{TIER_SENTENCE[c.excerpt.source.tier]}</p>
              <ul className="mt-2.5 space-y-1.5 text-sm">
                {[q, sc].map((check, i) => (
                  <li key={i} className="flex gap-2">
                    {check.ok ? (
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-indigo"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                    ) : (
                      <Circle className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
                    )}
                    <span className={check.ok ? "text-ink-2" : "text-ink-3"}>{check.text}</span>
                  </li>
                ))}
              </ul>
              {c.note && <p className="mt-1.5 text-sm text-ink-3">{c.note}</p>}
            </li>
          );
        })}
      </ol>

      {/* Where it stands, after the words themselves. */}
      <div className="mt-4 flex items-start gap-2.5 text-sm text-ink-2">
        <EvidenceSeal level={claim.level} tier={claimTier(claim)} className="mt-[3px]" />
        <span>{sealWords(claim.level)}</span>
      </div>
      {(tone === "turmeric" || tone === "madder" || claim.assessment !== "supported") && (
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
          Our assessment
          <Badge variant={tone === "madder" ? "refuted" : tone === "turmeric" ? "contested" : tone === "indigo" ? "evidence" : "neutral"}>
            {ASSESSMENT_LABELS[claim.assessment] ?? claim.assessment}
          </Badge>
        </p>
      )}

      {claim.lenses.length > 0 && (
        <p className="mt-2 text-sm text-ink-3">
          Where this reading comes from:{" "}
          {claim.lenses
            .map((l) => LENS_LABELS[l] ?? l)
            .join(", ")
            .toLowerCase()}
          .
        </p>
      )}

      {mentions.length > 0 && (
        <Collapsible className="mt-4">
          <CollapsibleTrigger className="rounded-md text-sm text-ink-2 underline decoration-rule underline-offset-3 hover:text-ink">
            Also mentioned in {mentions.length} more
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {mentions.map((c) => (
              <p key={c.id} className="text-sm text-ink-2">
                {plainCitation(c)}
              </p>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {claim.foundVia.length > 0 && (
        <p className="mt-4 text-sm text-ink-3">
          Found via{" "}
          {claim.foundVia.map((f, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {f.url ? (
                <a
                  href={f.url}
                  className="underline underline-offset-3"
                  target="_blank"
                  rel="noreferrer"
                >
                  {f.title ?? f.via}
                </a>
              ) : (
                (f.title ?? f.via)
              )}
            </span>
          ))}
          . Finding it there is not evidence for it; the words above are.
        </p>
      )}

      {claim.issues.filter((i) => i.severity === "warning").length > 0 && (
        <ul className="mt-4 space-y-1 rounded-lg bg-rule-soft px-3.5 py-2.5 text-sm text-ink-2">
          {claim.issues
            .filter((i) => i.severity === "warning")
            .map((i) => (
              <li key={i.code}>{ISSUE_PLAIN[i.code] ?? i.message}</li>
            ))}
        </ul>
      )}

      <YourClaimNote claimId={claim.id} />
      <div className="mt-6 flex flex-wrap gap-2">
        <Button render={<Link href={`/c/${claim.id}`} />} variant="outline" nativeButton={false}>
          How we know this
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await addToDeckAction([claim.id]);
              if (r.ok) toast.success(r.message ?? "Added to your reviews.");
              else toast.error(r.error);
            })
          }
        >
          <Plus data-icon="inline-start" /> Add to my reviews
        </Button>
        <AddToCanvas content={{ kind: "claim", claimId: claim.id }} what="this claim" size="sm" />
        <AskAi subject={{ type: "claim", id: claim.id, label: claim.text }} size="sm" />
        {/* The learner's own marks and note: a quieter second row. */}
        <div className="flex basis-full flex-wrap gap-1 empty:hidden">
          <HighlightButtons claimId={claim.id} />
          <YourNoteButton claimId={claim.id} what="this claim" />
        </div>
      </div>
    </section>
  );
}

export { QUOTE_OK };
