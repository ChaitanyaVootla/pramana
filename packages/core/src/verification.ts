import type {
  ClaimSupportCheck,
  ExcerptVerificationStatus,
  SupportCheck,
  SupportCheckBasis,
  SupportCheckStatus,
} from "./records";
import type { Assessment, ClaimKind, SourceTier, Stance } from "./vocab";

/**
 * The verification ladder (see docs/design.md):
 *   0  no source
 *   1  cited, but the quote has not been found in a stored copy of the source
 *   2  quote found in the source (machine check), or attested by a person
 *   3  an AI reviewer judged that the excerpt supports the claim, or that
 *      the claim's excerpts support it jointly (each quote verified)
 *   4  a human reviewer confirmed the excerpt (or excerpts jointly) support it
 * A claim's level is the best level among its non-"mentions" citations, or
 * its current joint support check, whichever is higher.
 * Levels describe how well the SOURCING has been checked, not whether the
 * claim is true; that is the separate editorial `assessment`.
 */
export type VerificationLevel = 0 | 1 | 2 | 3 | 4;

export const VERIFICATION_LABELS: Record<VerificationLevel, string> = {
  0: "No source",
  1: "Cited, quote not checked",
  2: "Quote found in source",
  3: "AI-checked support",
  4: "Human-reviewed",
};

export interface CitationEvidence {
  /** The citation's id; needed to match a joint support check's citations. */
  id?: string;
  stance: Stance;
  excerptStatus: ExcerptVerificationStatus;
  supportStatus: SupportCheckStatus;
  sourceId: string;
  sourceTier: SourceTier;
  /** The source this one derives from (an edition's work), for independence. */
  sourceRootId?: string | null;
  fuzzyScore?: number | null;
}

const QUOTE_OK = new Set<ExcerptVerificationStatus>(["exact", "fuzzy", "human_attested"]);

export function citationLevel(c: CitationEvidence): VerificationLevel {
  if (c.supportStatus === "human_rejected") return 0;
  const quoteOk = QUOTE_OK.has(c.excerptStatus);
  if (c.supportStatus === "human_confirmed") return 4;
  if (quoteOk && c.supportStatus === "ai_supports") return 3;
  if (quoteOk) return 2;
  return 1;
}

export type SupportCheckState = "current" | "stale";

/**
 * Whether a citation's support judgment still applies: the claim text, the
 * excerpt, its quote and the stance must be what they were when it was made.
 * Unchecked citations, and judgments recorded before bases were kept, are current.
 */
export function supportCheckState(
  check: Pick<SupportCheck, "status" | "basis">,
  now: SupportCheckBasis,
): SupportCheckState {
  const b = check.basis;
  if (check.status === "unchecked" || !b) return "current";
  const same =
    b.claimTextSha256 === now.claimTextSha256 &&
    b.excerptId === now.excerptId &&
    b.quoteSha256 === now.quoteSha256 &&
    b.stance === now.stance;
  return same ? "current" : "stale";
}

/** The status that counts for the level: a stale judgment counts as not yet checked. */
export function effectiveSupportStatus(status: SupportCheckStatus, state: SupportCheckState): SupportCheckStatus {
  return state === "stale" ? "unchecked" : status;
}

/** A joint support check as it bears on the level: its status, its citations, and whether it is current. */
export interface JointSupportEvidence {
  status: ClaimSupportCheck["status"];
  citationIds: string[];
  /** False once the claim text or its set of citations has changed since the judgment. */
  current: boolean;
}

export type JointSupportState = "current" | "stale";

/**
 * Whether a joint judgment still applies: the claim text (by hash) and the
 * claim's full set of citations must be what they were when it was made.
 */
export function jointSupportState(
  check: Pick<ClaimSupportCheck, "basis">,
  now: { textSha256: string; citationIds: string[] },
): JointSupportState {
  const was = [...check.basis.citationIds].sort();
  const is = [...now.citationIds].sort();
  const same = was.length === is.length && was.every((id, i) => id === is[i]);
  return same && check.basis.textSha256 === now.textSha256 ? "current" : "stale";
}

/**
 * Level from a joint check: 3 (AI) or 4 (person) when it is current, judged
 * "supports", and every considered citation is evidential, not rejected by a
 * person, and has its quote verified. Otherwise it adds nothing.
 */
export function jointLevel(
  citations: CitationEvidence[],
  joint: JointSupportEvidence | null | undefined,
): VerificationLevel {
  if (!joint?.current || !joint.citationIds.length) return 0;
  if (joint.status !== "ai_supports" && joint.status !== "human_confirmed") return 0;
  const byId = new Map(citations.filter((c) => c.id).map((c) => [c.id!, c]));
  const considered = joint.citationIds.map((id) => byId.get(id));
  const ok = considered.every(
    (c) =>
      c &&
      c.stance !== "mentions" &&
      c.supportStatus !== "human_rejected" &&
      QUOTE_OK.has(c.excerptStatus),
  );
  if (!ok) return 0;
  return joint.status === "human_confirmed" ? 4 : 3;
}

export function claimLevel(
  citations: CitationEvidence[],
  joint?: JointSupportEvidence | null,
): VerificationLevel {
  let best: VerificationLevel = 0;
  for (const c of citations) {
    if (c.stance === "mentions") continue;
    const level = citationLevel(c);
    if (level > best) best = level;
  }
  const j = jointLevel(citations, joint);
  return j > best ? j : best;
}

export interface LintIssue {
  severity: "warning" | "info";
  code: string;
  message: string;
}

/**
 * Cheap, deterministic checks on a claim's sourcing. Advisory: shown to
 * reviewers and readers, never silently "fixing" anything.
 */
export function lintClaim(input: {
  kind: ClaimKind;
  assessment: Assessment;
  citations: CitationEvidence[];
  hasCorrection?: boolean;
}): LintIssue[] {
  const issues: LintIssue[] = [];
  const evidential = input.citations.filter(
    (c) => c.stance !== "mentions" && c.supportStatus !== "human_rejected",
  );
  if (evidential.length === 0) {
    issues.push({ severity: "warning", code: "no_sources", message: "No sources cited yet." });
  }
  const supporting = evidential.filter((c) => c.stance === "supports" && citationLevel(c) >= 2);
  const independentRoots = new Set(supporting.map((c) => c.sourceRootId ?? c.sourceId));
  if (input.assessment === "well_supported" && independentRoots.size < 2) {
    issues.push({
      severity: "warning",
      code: "well_supported_needs_two",
      message:
        "Marked well-supported, but fewer than two independent sources have verified supporting quotes.",
    });
  }
  if (
    (input.assessment === "well_supported" || input.assessment === "supported") &&
    evidential.length > 0 &&
    evidential.every((c) => c.sourceTier === "tertiary")
  ) {
    issues.push({
      severity: "warning",
      code: "tertiary_only",
      message:
        "Only tertiary sources (encyclopedias, textbooks) support this; trace it to the sources they cite.",
    });
  }
  if (evidential.some((c) => c.excerptStatus === "not_found")) {
    issues.push({
      severity: "warning",
      code: "quote_not_found",
      message: "A quoted excerpt could not be found in its stored source text.",
    });
  }
  if (evidential.some((c) => c.excerptStatus === "fuzzy" && (c.fuzzyScore ?? 1) < 0.95)) {
    issues.push({
      severity: "info",
      code: "fuzzy_quote",
      message:
        "A quote only approximately matches the source text (likely OCR noise); worth a manual look.",
    });
  }
  if (input.kind === "misconception" && !input.hasCorrection) {
    issues.push({
      severity: "info",
      code: "misconception_uncorrected",
      message: "Misconception without a linked correcting claim.",
    });
  }
  if (
    input.kind === "misconception" &&
    (input.assessment === "well_supported" || input.assessment === "supported")
  ) {
    issues.push({
      severity: "info",
      code: "misconception_supported",
      message:
        "Recorded as a misconception but assessed as supported; check the kind or assessment.",
    });
  }
  return issues;
}
