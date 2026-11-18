import type { ClaimCard } from "@pramana/services";
import Link from "next/link";
import { EvidenceSeal } from "@/components/evidence/EvidenceSeal";
import { claimTier } from "@/lib/era";
import { ASSESSMENT_LABELS, assessmentTone } from "@/lib/labels";
import { cn } from "@/lib/utils";

type ListedClaim = {
  id: string;
  text: string;
  level?: ClaimCard["level"];
  assessment?: string;
  kind?: string;
  whenLabel?: string | null;
  citations?: ClaimCard["citations"];
};

/** A navigational list of claims (outside the reader): each opens its evidence lineage. */
export function ClaimList({ claims, className }: { claims: ListedClaim[]; className?: string }) {
  return (
    <ul className={cn("-ml-3 space-y-0.5", className)}>
      {claims.map((c) => {
        const tone = c.assessment ? assessmentTone(c.assessment, c.kind) : "neutral";
        const notable = tone === "turmeric" || tone === "madder" || c.assessment === "unassessed";
        return (
          <li key={c.id}>
            <Link
              href={`/c/${c.id}`}
              className={cn(
                "group relative flex items-start gap-3 rounded-md py-2 pr-2 pl-3 no-underline transition-colors hover:bg-rule-soft/70",
                "before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-[2px] before:rounded-full before:bg-rule hover:before:bg-indigo-tint",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base text-ink group-hover:underline group-hover:decoration-indigo-tint group-hover:underline-offset-4">
                  {c.text}
                </span>
                {(c.whenLabel || (notable && c.assessment)) && (
                  <span className="mt-0.5 flex flex-wrap gap-x-3 font-sans text-sm text-ink-3">
                    {c.whenLabel && <span className="tnum">{c.whenLabel}</span>}
                    {notable && c.assessment && (
                      <span
                        className={
                          tone === "madder"
                            ? "text-madder"
                            : tone === "turmeric"
                              ? "text-turmeric-ink"
                              : undefined
                        }
                      >
                        {ASSESSMENT_LABELS[c.assessment] ?? c.assessment}
                      </span>
                    )}
                  </span>
                )}
              </span>
              {c.level !== undefined && (
                <EvidenceSeal
                  level={c.level}
                  tier={
                    c.citations ? claimTier({ citations: c.citations } as ClaimCard) : undefined
                  }
                  className="mt-1.5"
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
