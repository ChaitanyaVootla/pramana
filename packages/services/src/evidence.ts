import { createHash } from "node:crypto";
import {
  claimLevel,
  effectiveSupportStatus,
  jointSupportState,
  lintClaim,
  supportCheckState,
  type Assessment,
  type CitationEvidence,
  type ClaimSupportCheck,
  type ClaimKind,
  type LintIssue,
  type SourceTier,
  type JointSupportState,
  type Stance,
  type SupportCheck,
  type SupportCheckBasis,
  type SupportCheckState,
  type VerificationLevel,
} from "@pramana/core";
import { citations, claimRelations, claims, excerpts, sources, type DbOrTx } from "@pramana/db";
import { and, eq, inArray } from "drizzle-orm";

export interface ClaimEvidenceSummary {
  claimId: string;
  level: VerificationLevel;
  issues: LintIssue[];
  citationCount: number;
  /** The joint support check, if any, and whether it still applies. */
  jointSupport: JointSupportView | null;
}

export type JointSupportView = ClaimSupportCheck & { state: JointSupportState };

/** What a joint support check is pinned to: the claim text, hashed. */
export function claimTextSha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** What a citation's support check is pinned to, as things stand now. */
export function citationBasis(
  claimText: string,
  excerptId: string,
  quote: string | null,
  stance: string,
): SupportCheckBasis {
  return {
    claimTextSha256: claimTextSha256(claimText),
    excerptId,
    quoteSha256: quote === null ? null : createHash("sha256").update(quote, "utf8").digest("hex"),
    stance,
  };
}

export type SupportCheckView = SupportCheck & { state: SupportCheckState };

/** Verification level and lint issues for many claims at once. */
export async function evidenceFor(
  db: DbOrTx,
  claimIds: string[],
): Promise<Map<string, ClaimEvidenceSummary>> {
  const out = new Map<string, ClaimEvidenceSummary>();
  if (claimIds.length === 0) return out;
  const ids = [...new Set(claimIds)];
  const claimRows = await db
    .select({
      id: claims.id,
      text: claims.text,
      kind: claims.kind,
      assessment: claims.assessment,
      supportCheck: claims.supportCheck,
    })
    .from(claims)
    .where(inArray(claims.id, ids));
  const rows = await db
    .select({
      id: citations.id,
      claimId: citations.claimId,
      excerptId: citations.excerptId,
      quote: excerpts.quote,
      stance: citations.stance,
      support: citations.supportCheck,
      verification: excerpts.verification,
      sourceId: sources.id,
      tier: sources.tier,
      derivedFromId: sources.derivedFromId,
    })
    .from(citations)
    .innerJoin(excerpts, eq(excerpts.id, citations.excerptId))
    .innerJoin(sources, eq(sources.id, excerpts.sourceId))
    .where(inArray(citations.claimId, ids));
  const corrections = await db
    .select({ toId: claimRelations.toId })
    .from(claimRelations)
    .where(and(inArray(claimRelations.toId, ids), eq(claimRelations.type, "corrects")));
  const corrected = new Set(corrections.map((c) => c.toId));

  const roots = await sourceRoots(db, rows.map((r) => r.sourceId));
  const textOf = new Map(claimRows.map((c) => [c.id, c.text]));
  const byClaim = new Map<string, CitationEvidence[]>();
  for (const r of rows) {
    const list = byClaim.get(r.claimId) ?? [];
    const state = supportCheckState(
      r.support,
      citationBasis(textOf.get(r.claimId) ?? "", r.excerptId, r.quote, r.stance),
    );
    list.push({
      id: r.id,
      stance: r.stance as Stance,
      excerptStatus: r.verification.status,
      supportStatus: effectiveSupportStatus(r.support.status, state),
      sourceId: r.sourceId,
      sourceTier: r.tier as SourceTier,
      sourceRootId: roots.get(r.sourceId) ?? r.sourceId,
      fuzzyScore: r.verification.score ?? null,
    });
    byClaim.set(r.claimId, list);
  }
  for (const c of claimRows) {
    const evidence = byClaim.get(c.id) ?? [];
    const jointSupport: JointSupportView | null = c.supportCheck
      ? {
          ...c.supportCheck,
          state: jointSupportState(c.supportCheck, {
            textSha256: claimTextSha256(c.text),
            citationIds: evidence.map((e) => e.id!),
          }),
        }
      : null;
    out.set(c.id, {
      claimId: c.id,
      level: claimLevel(
        evidence,
        jointSupport && {
          status: jointSupport.status,
          citationIds: jointSupport.citationIds,
          current: jointSupport.state === "current",
        },
      ),
      issues: lintClaim({
        kind: c.kind as ClaimKind,
        assessment: c.assessment as Assessment,
        citations: evidence,
        hasCorrection: corrected.has(c.id),
      }),
      citationCount: evidence.length,
      jointSupport,
    });
  }
  return out;
}

/**
 * The root work of each source, following `derived_from` all the way up
 * (translation -> edition -> work), so two versions of one work count once.
 * Cycles and very deep chains stop where they are detected.
 */
export async function sourceRoots(db: DbOrTx, ids: string[]): Promise<Map<string, string>> {
  const parent = new Map<string, string | null>();
  let frontier = [...new Set(ids)];
  for (let depth = 0; frontier.length && depth < 16; depth++) {
    const rows = await db
      .select({ id: sources.id, derivedFromId: sources.derivedFromId })
      .from(sources)
      .where(inArray(sources.id, frontier));
    for (const r of rows) parent.set(r.id, r.derivedFromId);
    frontier = rows.map((r) => r.derivedFromId).filter((p): p is string => Boolean(p) && !parent.has(p!));
  }
  const out = new Map<string, string>();
  for (const id of new Set(ids)) {
    let cur = id;
    const seen = new Set([cur]);
    for (let next = parent.get(cur); next && !seen.has(next); next = parent.get(cur)) {
      seen.add(next);
      cur = next;
    }
    out.set(id, cur);
  }
  return out;
}
