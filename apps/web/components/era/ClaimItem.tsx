"use client";

import type { ClaimCard } from "@pramana/services";
import { ChevronRight } from "lucide-react";
import { claimTier } from "@/lib/era";
import { ASSESSMENT_GLOSS, ASSESSMENT_LABELS, assessmentTone } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { EvidenceSeal } from "@/components/evidence/EvidenceSeal";
import { HighlightMark } from "@/components/yourview/Customise";

/** One claim in a chapter: the statement, its date, its standing if notable, and the seal. */
export function ClaimItem({
  claim,
  selected,
  onSelect,
  anchor = true,
  unlabelled = [],
  cue = false,
}: {
  claim: ClaimCard | undefined;
  selected?: boolean;
  onSelect?: (id: string) => void;
  /** Carry the claim's #claim-<id> anchor (off for a second listing of the same claim). */
  anchor?: boolean;
  /** Assessments the surrounding block already states (a debate is contested as a whole). */
  unlabelled?: string[];
  /** Say on the row that it opens the evidence (where nothing around it says so, as on entity pages). */
  cue?: boolean;
}) {
  if (!claim)
    return (
      <li className="font-sans text-sm text-ink-3">A claim on this page could not be found.</li>
    );
  const tone = assessmentTone(claim.assessment, claim.kind);
  const notable =
    (tone === "turmeric" || tone === "madder" || claim.assessment === "unassessed") &&
    !unlabelled.includes(claim.assessment);
  const unassessed = notable && claim.assessment === "unassessed";
  const source = claim.citations.find((c) => c.stance !== "mentions");
  const warned = notable && !unassessed;
  return (
    <li>
      <button
        type="button"
        id={anchor ? `claim-${claim.id}` : undefined}
        onClick={() => onSelect?.(claim.id)}
        aria-pressed={selected}
        className={cn(
          "group relative flex w-full flex-col items-start gap-1.5 rounded-lg py-2.5 pr-3 pl-4 text-left transition-colors duration-150 sm:flex-row sm:gap-3",
          "before:absolute before:top-3 before:bottom-3 before:left-0 before:w-[3px] before:rounded-full before:transition-colors",
          selected
            ? "bg-indigo-wash before:bg-indigo"
            : "before:bg-rule hover:bg-rule-soft/70 hover:before:bg-indigo-tint focus-visible:before:bg-indigo-tint",
        )}
      >
        <span className="min-w-0 flex-1">
          {/* A doubtful claim says so before it is read, so a newcomer never takes it as fact. */}
          {warned && (
            <span
              title={ASSESSMENT_GLOSS[claim.assessment]}
              className={cn(
                "mb-0.5 block font-sans text-sm font-medium",
                tone === "madder" ? "text-madder" : "text-turmeric-ink",
              )}
            >
              Our assessment:{" "}
              {(ASSESSMENT_LABELS[claim.assessment] ?? claim.assessment).toLowerCase()}
            </span>
          )}
          <span className={cn("block text-base leading-[1.55] text-ink", selected && "text-ink")}>
            {claim.text}
          </span>
          {(claim.whenLabel || unassessed) && (
            <span className="mt-1 flex flex-wrap gap-x-3 font-sans text-sm text-ink-3">
              {claim.whenLabel && <span className="tnum">{claim.whenLabel}</span>}
              {unassessed && (
                <span
                  title={ASSESSMENT_GLOSS.unassessed}
                  className="evidence-standard font-medium text-ink-3"
                >
                  {ASSESSMENT_LABELS.unassessed}
                </span>
              )}
            </span>
          )}
          {/* At Full evidence density, the source each claim rests on, by name. */}
          {source && (
            <span className="evidence-full mt-1 block font-sans text-sm text-ink-3">
              {source.excerpt.source.short}
              {source.excerpt.locatorLabel ? `, ${source.excerpt.locatorLabel}` : ""}
            </span>
          )}
        </span>
        {/* The learner's own mark (your view) sits beside the seal. */}
        <span className="flex shrink-0 items-center gap-1.5 sm:mt-2">
          <HighlightMark claimId={claim.id} />
          <EvidenceSeal level={claim.level} tier={claimTier(claim)} />
          {cue && (
            <span className="ml-1 flex items-center gap-0.5 font-sans text-sm text-indigo group-hover:underline group-hover:underline-offset-3">
              Evidence
              <ChevronRight className="size-3.5" aria-hidden />
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
