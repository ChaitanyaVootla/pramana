import {
  ClaimSupportCheck,
  findQuote,
  jointSupportState,
  SupportCheck,
  supportCheckState,
  SupportVerdict,
  type ExcerptVerification,
} from "@pramana/core";
import { citations, claims, excerpts, getDb } from "@pramana/db";
import { eq } from "drizzle-orm";
import { recordEvent } from "./audit";
import type { ActorContext } from "./context";
import { citationBasis, claimTextSha256 } from "./evidence";
import { loadSnapshotText } from "./snapshots";
import { NotFoundError, ValidationError } from "./util";

/**
 * Checks are metadata ABOUT content (is the quote in the source? does the
 * excerpt support the claim?), so they are recorded directly with an audit
 * event rather than reviewed as changesets. Who checked is always recorded,
 * and an agent can only ever produce "ai_*" verdicts.
 */

export async function reverifyExcerpt(
  ctx: ActorContext,
  excerptId: string,
): Promise<ExcerptVerification> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(excerpts).where(eq(excerpts.id, excerptId)).for("update");
    if (!row) throw new NotFoundError(`excerpt ${excerptId} not found`);
    let verification: ExcerptVerification;
    let selector = row.selector;
    if (!row.quote) verification = { status: "no_quote" };
    else if (!row.snapshotId) verification = { status: "no_snapshot" };
    else {
      const { text, normalized } = await loadSnapshotText(row.snapshotId);
      const m = findQuote(text, row.quote, { normalized });
      verification = {
        status: m.status === "exact" ? "exact" : m.status === "fuzzy" ? "fuzzy" : "not_found",
        score: Number(m.score.toFixed(4)),
        method: "quote-match-v1",
        checkedAt: new Date().toISOString(),
        checkedBy: ctx.actorId,
      };
      selector = m.quote && m.position ? { quote: m.quote, position: m.position } : null;
    }
    // A person's attestation stands unless the machine check positively finds the quote.
    const found = verification.status === "exact" || verification.status === "fuzzy";
    if (row.verification.status === "human_attested" && !found) {
      return row.verification;
    }
    await tx.update(excerpts).set({ verification, selector }).where(eq(excerpts.id, excerptId));
    await recordEvent(tx, ctx, {
      action: "excerpt.verified",
      subjectType: "excerpt",
      subjectId: excerptId,
      data: { before: row.verification, after: verification },
    });
    return verification;
  });
}

/** A person attests they checked the quote against the source (e.g. a printed book they own). */
export async function attestExcerpt(
  ctx: ActorContext,
  excerptId: string,
  note: string,
): Promise<ExcerptVerification> {
  if (ctx.kind !== "human") throw new ValidationError("only a person can attest an excerpt");
  return getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(excerpts).where(eq(excerpts.id, excerptId)).for("update");
    if (!row) throw new NotFoundError(`excerpt ${excerptId} not found`);
    const verification: ExcerptVerification = {
      status: "human_attested",
      checkedAt: new Date().toISOString(),
      checkedBy: ctx.actorId,
      note,
    };
    await tx.update(excerpts).set({ verification }).where(eq(excerpts.id, excerptId));
    await recordEvent(tx, ctx, {
      action: "excerpt.attested",
      subjectType: "excerpt",
      subjectId: excerptId,
      rationale: note,
      data: { before: row.verification },
    });
    return verification;
  });
}

const HUMAN_STATUS: Record<SupportVerdict, SupportCheck["status"]> = {
  supports: "human_confirmed",
  partial: "human_partial",
  unsupported: "human_rejected",
};
const AI_STATUS: Record<SupportVerdict, SupportCheck["status"]> = {
  supports: "ai_supports",
  partial: "ai_partial",
  unsupported: "ai_unsupported",
};

/**
 * Record a judgment on whether an excerpt supports the claim it is cited for.
 * Agents produce ai_* statuses; people produce human_*. The judgment is pinned
 * to the claim text, the excerpt, its quote and the stance, and stops counting
 * if any of them changes. An agent cannot replace a person's judgment while
 * it still applies.
 */
export async function recordSupportCheck(
  ctx: ActorContext,
  citationId: string,
  rawVerdict: SupportVerdict,
  note: string,
): Promise<SupportCheck> {
  const verdict = SupportVerdict.parse(rawVerdict);
  return getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(citations).where(eq(citations.id, citationId)).for("update");
    if (!row) throw new NotFoundError(`citation ${citationId} not found`);
    const [claim] = await tx.select({ text: claims.text }).from(claims).where(eq(claims.id, row.claimId));
    const [excerpt] = await tx.select({ quote: excerpts.quote }).from(excerpts).where(eq(excerpts.id, row.excerptId));
    if (!claim || !excerpt) throw new NotFoundError(`claim or excerpt of citation ${citationId} not found`);
    const basis = citationBasis(claim.text, row.excerptId, excerpt.quote, row.stance);
    const isHuman = ctx.kind === "human";
    if (
      !isHuman &&
      row.supportCheck.status.startsWith("human_") &&
      supportCheckState(row.supportCheck, basis) === "current"
    ) {
      throw new ValidationError(
        `a person has already judged this citation (${row.supportCheck.status}); an agent cannot override that`,
      );
    }
    const status = (isHuman ? HUMAN_STATUS : AI_STATUS)[verdict];
    const check = SupportCheck.parse({ status, by: ctx.actorId, at: new Date().toISOString(), note, basis });
    await tx.update(citations).set({ supportCheck: check }).where(eq(citations.id, citationId));
    await recordEvent(tx, ctx, {
      action: "citation.support_checked",
      subjectType: "citation",
      subjectId: citationId,
      rationale: note,
      data: { claimId: row.claimId, before: row.supportCheck, after: check },
    });
    return check;
  });
}

/**
 * Record a judgment on a claim as a whole: do the given citations, read
 * together, support it? For compound claims whose parts rest on different
 * excerpts. The judgment is pinned to the claim text and its full set of
 * citations, and stops counting if either changes. An agent cannot replace a
 * person's judgment while it still applies.
 */
export async function recordClaimSupport(
  ctx: ActorContext,
  claimId: string,
  rawVerdict: SupportVerdict,
  note: string,
  citationIds: string[],
): Promise<ClaimSupportCheck> {
  const verdict = SupportVerdict.parse(rawVerdict);
  return getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(claims).where(eq(claims.id, claimId)).for("update");
    if (!row) throw new NotFoundError(`claim ${claimId} not found`);
    const cited = await tx.select().from(citations).where(eq(citations.claimId, claimId));
    const byId = new Map(cited.map((c) => [c.id, c]));
    const considered = [...new Set(citationIds)];
    if (considered.length === 0) throw new ValidationError("name at least one citation that was considered");
    for (const id of considered) {
      const c = byId.get(id);
      if (!c) throw new ValidationError(`citation ${id} is not on claim ${claimId}`);
      if (c.stance === "mentions") {
        throw new ValidationError(`citation ${id} only mentions the claim; it cannot count as evidence`);
      }
    }
    const basis = { textSha256: claimTextSha256(row.text), citationIds: cited.map((c) => c.id).sort() };
    const isHuman = ctx.kind === "human";
    const before = row.supportCheck;
    if (
      !isHuman &&
      before?.status.startsWith("human_") &&
      jointSupportState(before, basis) === "current"
    ) {
      throw new ValidationError(
        `a person has already judged this claim's citations together (${before.status}); an agent cannot override that`,
      );
    }
    const check = ClaimSupportCheck.parse({
      status: (isHuman ? HUMAN_STATUS : AI_STATUS)[verdict],
      by: ctx.actorId,
      at: new Date().toISOString(),
      note,
      citationIds: considered,
      basis,
    });
    await tx.update(claims).set({ supportCheck: check }).where(eq(claims.id, claimId));
    await recordEvent(tx, ctx, {
      action: "claim.support_checked",
      subjectType: "claim",
      subjectId: claimId,
      rationale: note,
      data: { before, after: check },
    });
    return check;
  });
}
