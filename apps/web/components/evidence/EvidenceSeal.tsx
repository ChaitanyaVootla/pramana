import { VERIFICATION_LABELS, type VerificationLevel } from "@pramana/core";
import { BookOpen, Globe, Landmark, ScrollText } from "lucide-react";
import type { SourceTierGlyph } from "@/lib/era";
import { cn } from "@/lib/utils";

const TIER: Record<Exclude<SourceTierGlyph, "none">, { Icon: typeof Landmark; label: string }> = {
  inscription: { Icon: Landmark, label: "Rests on an inscription" },
  text: { Icon: ScrollText, label: "Rests on an ancient text" },
  scholarship: { Icon: BookOpen, label: "Rests on modern scholarship" },
  reference: { Icon: Globe, label: "Rests on a reference work only" },
};

/** Level in words, for tooltips and screen readers. */
export function sealWords(level: VerificationLevel): string {
  switch (level) {
    case 0:
      return "No source yet.";
    case 1:
      return "Cited, but the quote has not been checked.";
    case 2:
      return "Quote found in the source. Not yet reviewed by a person.";
    case 3:
      return "Quote found, and an AI reviewer judged that it says what it is cited for.";
    case 4:
      return "Checked by a person.";
  }
}

/**
 * The evidence seal: four small cells filled to the verification level, and a
 * glyph for the kind of source. Hollow at L0 (the gap is shown, not hidden);
 * green only when a person has confirmed it.
 */
export function EvidenceSeal({
  level,
  tier,
  className,
}: {
  level: VerificationLevel;
  tier?: SourceTierGlyph;
  className?: string;
}) {
  const T = tier && tier !== "none" ? TIER[tier] : null;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-[3px] align-middle", className)}
      role="img"
      aria-label={`${VERIFICATION_LABELS[level]}. ${T ? T.label : ""}`}
      title={`${sealWords(level)}${T ? ` ${T.label}.` : ""}`}
    >
      {[1, 2, 3, 4].map((n) => (
        <i
          key={n}
          className={cn(
            "inline-block h-[9px] w-[6px] rounded-[2px] transition-colors",
            n <= level
              ? level === 4
                ? "bg-sage"
                : "bg-indigo"
              : level === 0
                ? "border border-dashed border-ink-3/70"
                : "bg-rule",
          )}
        />
      ))}
      {T && <T.Icon className="ml-1.5 size-3.5 text-ink-3" strokeWidth={1.75} aria-hidden />}
    </span>
  );
}
