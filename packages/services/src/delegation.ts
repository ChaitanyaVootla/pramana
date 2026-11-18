import { events, getDb, type DbOrTx } from "@pramana/db";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { recordEvent } from "./audit";
import { PermissionError, type ActorContext } from "./context";

/**
 * A standing instruction from the human letting agents approve changesets on
 * their behalf. It is an audit event, never a hidden flag: who asked, when and
 * in what words. Every approval made under it names the delegation, so the
 * record never pretends a person reviewed what an agent approved. The latest of
 * granted/revoked wins; revoking stops agent approvals at once.
 */
export const DELEGATION_GRANTED = "approval_delegation.granted";
export const DELEGATION_REVOKED = "approval_delegation.revoked";

export interface ApprovalDelegation {
  eventId: string;
  at: Date;
  /** The human's instruction, verbatim. */
  instruction: string;
  /** The human it was granted for. */
  humanId: string;
}

function humanOf(ctx: ActorContext): string {
  const id = ctx.kind === "human" ? ctx.actorId : ctx.onBehalfOfId;
  if (!id) throw new PermissionError(`"${ctx.handle}" does not act for a person`);
  return id;
}

export async function activeApprovalDelegation(
  humanId: string,
  db: DbOrTx = getDb(),
): Promise<ApprovalDelegation | null> {
  const [last] = await db
    .select()
    .from(events)
    .where(
      and(
        inArray(events.action, [DELEGATION_GRANTED, DELEGATION_REVOKED]),
        or(eq(events.actorId, humanId), eq(events.onBehalfOfId, humanId)),
      ),
    )
    .orderBy(desc(events.at))
    .limit(1);
  if (!last || last.action !== DELEGATION_GRANTED) return null;
  const data = last.data as { instruction?: string };
  return { eventId: last.id, at: last.at, instruction: data.instruction ?? last.rationale ?? "", humanId };
}

/** Record the human's instruction. `instruction` must be their own words, quoted. */
export async function grantApprovalDelegation(ctx: ActorContext, instruction: string): Promise<string> {
  const humanId = humanOf(ctx);
  return recordEvent(getDb(), ctx, {
    action: DELEGATION_GRANTED,
    subjectType: "actor",
    subjectId: humanId,
    rationale: instruction,
    data: { scope: "approve_changesets", instruction, recordedBy: ctx.handle },
  });
}

export async function revokeApprovalDelegation(ctx: ActorContext, note?: string): Promise<string> {
  const humanId = humanOf(ctx);
  return recordEvent(getDb(), ctx, {
    action: DELEGATION_REVOKED,
    subjectType: "actor",
    subjectId: humanId,
    rationale: note,
    data: { scope: "approve_changesets", recordedBy: ctx.handle },
  });
}
