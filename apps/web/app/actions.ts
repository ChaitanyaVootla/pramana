"use server";

import { ReviewInput, SupportVerdict } from "@pramana/core";
import { z } from "zod";
import * as svc from "@pramana/services";
import { revalidatePath } from "next/cache";

/**
 * Server actions run as the local human user. Every one goes through the
 * services layer, so the audit trail is identical to MCP-originated actions.
 * Arguments are validated at runtime: server actions are reachable by POST,
 * so TypeScript types alone guarantee nothing.
 */

const Id = z.uuid();
const Note = z.string().max(4000);
const Path = z
  .string()
  .regex(/^\/[a-z0-9/_-]*$/i)
  .max(200);

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function attempt(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn();
    return { ok: true, ...(message ? { message } : {}) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function approveChangesetAction(
  id: string,
  note: string,
  withDependencies: boolean,
): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await svc.humanContext();
    const result = await svc.approveChangeset(ctx, Id.parse(id), {
      note: Note.parse(note) || undefined,
      withDependencies: z.boolean().parse(withDependencies),
    });
    revalidatePath("/", "layout");
    if (result.status === "failed") throw new Error(`Could not apply: ${result.error}`);
    return result.applied && result.applied.length > 1
      ? `Applied ${result.applied.length} changesets.`
      : "Applied.";
  });
}

export async function rejectChangesetAction(id: string, note: string): Promise<ActionResult> {
  return attempt(async () => {
    if (!Note.parse(note).trim()) throw new Error("Say why, so the author can fix it.");
    await svc.rejectChangeset(await svc.humanContext(), Id.parse(id), note);
    revalidatePath("/", "layout");
    return "Rejected.";
  });
}

export async function addToDeckAction(claimIds: string[]): Promise<ActionResult> {
  return attempt(async () => {
    const { added } = await svc.addCards(
      await svc.humanContext(),
      z.array(Id).max(500).parse(claimIds),
    );
    revalidatePath("/learn");
    return added ? `Added ${added} to your reviews.` : "Already in your reviews.";
  });
}

export async function addPageToDeckAction(pageId: string): Promise<ActionResult> {
  return attempt(async () => {
    const { added } = await svc.addPageToDeck(await svc.humanContext(), Id.parse(pageId));
    revalidatePath("/learn");
    return added
      ? `Added ${added} claims to your reviews.`
      : "Everything on this page is already in your reviews.";
  });
}

export async function recordReviewAction(input: ReviewInput): Promise<ActionResult> {
  return attempt(async () => {
    const result = await svc.recordReview(await svc.humanContext(), ReviewInput.parse(input));
    return `Next review ${result.nextDue.toISOString()}`;
  });
}

export async function markVisitedAction(pageId: string): Promise<void> {
  await svc.recordPageVisit(await svc.humanContext(), Id.parse(pageId));
}

export async function archiveNoteAction(id: string): Promise<ActionResult> {
  return attempt(async () => {
    await svc.archiveNote(await svc.humanContext(), Id.parse(id));
  });
}

export async function attestExcerptAction(
  excerptId: string,
  note: string,
  path: string,
): Promise<ActionResult> {
  return attempt(async () => {
    if (!Note.parse(note).trim()) throw new Error("Say what you checked it against.");
    await svc.attestExcerpt(await svc.humanContext(), Id.parse(excerptId), note);
    revalidatePath(Path.parse(path));
    return "Marked as checked by you.";
  });
}

export async function judgeSupportAction(
  citationId: string,
  verdict: SupportVerdict,
  note: string,
  path: string,
): Promise<ActionResult> {
  return attempt(async () => {
    const v = SupportVerdict.parse(verdict);
    await svc.recordSupportCheck(
      await svc.humanContext(),
      Id.parse(citationId),
      v,
      Note.parse(note) || "Reviewed in the web UI",
    );
    revalidatePath(Path.parse(path));
    return v === "unsupported"
      ? "Marked as not supporting the claim."
      : v === "partial"
        ? "Marked as partly supporting the claim."
        : "Confirmed.";
  });
}

/**
 * "Stop auto-approval": the person withdraws their standing instruction, so
 * agents can no longer approve for them. Only the person can do this (the
 * context is the local human); the services record it as an audit event.
 */
export async function stopAutoApprovalAction(note: string): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await svc.humanContext();
    if (ctx.kind !== "human") throw new Error("Only you can stop auto-approval.");
    await svc.revokeApprovalDelegation(ctx, Note.parse(note) || undefined);
    revalidatePath("/review");
    return "Auto-approval is off. Proposals now wait for you here.";
  });
}
