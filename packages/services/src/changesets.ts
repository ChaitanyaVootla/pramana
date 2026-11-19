import {
  ChangesetInput,
  createdKind,
  resolveRefs,
  uuidv7,
  type ChangesetInputRaw,
  type ChangeOp,
  type ChangesetStatus,
} from "@pramana/core";
import { actors, changesets, getDb, type Tx } from "@pramana/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  applyOps,
  OpError,
  type ApplyState,
  type ExcerptCheck,
  type OpOutcome,
  type StoredOp,
} from "./apply";
import { recordEvent } from "./audit";
import { PermissionError, requireEditor, requireHuman, type ActorContext } from "./context";
import { activeApprovalDelegation } from "./delegation";
import { evidenceFor, type ClaimEvidenceSummary } from "./evidence";
import { NotFoundError, ValidationError } from "./util";

/**
 * Changesets: propose -> (dry run) -> review -> apply.
 *
 * Proposal validates the ops, assigns ids to everything they create, resolves
 * "@refs", and runs the whole changeset (plus any pending changesets it
 * depends on) inside a transaction that is then rolled back. The proposer gets
 * immediate feedback (quote checks, sourcing warnings) and the reviewer sees
 * exactly what will happen. Approval re-runs the same ops for real.
 */

export interface ChangesetReport {
  outcomes: OpOutcome[];
  excerptChecks: ExcerptCheck[];
  claims: ClaimEvidenceSummary[];
}

export interface ProposalResult {
  id: string;
  status: ChangesetStatus;
  refs: Record<string, string>;
  report: ChangesetReport;
}

/** Thrown to roll back the dry-run transaction. */
class DryRunRollback extends Error {
  constructor() {
    super("dry run");
  }
}

type ChangesetRow = typeof changesets.$inferSelect;

async function loadChangeset(id: string): Promise<ChangesetRow> {
  const row = await getDb().query.changesets.findFirst({ where: eq(changesets.id, id) });
  if (!row) throw new NotFoundError(`changeset ${id} not found`);
  return row;
}

/** Statuses from which a changeset can still be applied ("failed" can be retried). */
const OPEN: ChangesetStatus[] = ["proposed", "failed"];

/** Thrown when a changeset is no longer open; never turns it into "failed". */
class StatusGuardError extends ValidationError {}

/** Pending dependencies in apply order (depth-first), excluding already-applied ones. */
async function pendingChain(ids: string[], seen = new Set<string>()): Promise<ChangesetRow[]> {
  const out: ChangesetRow[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const row = await loadChangeset(id);
    if (row.status === "applied") continue;
    if (!OPEN.includes(row.status))
      throw new ValidationError(`depends on changeset ${id}, which is ${row.status}`);
    out.push(...(await pendingChain(row.dependsOn, seen)), row);
  }
  return out;
}

/** Refs declared by a set of changesets and everything they depend on, applied or not. */
async function transitiveRefs(
  ids: string[],
  out = new Map<string, string>(),
  seen = new Set<string>(),
) {
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const row = await loadChangeset(id);
    await transitiveRefs(row.dependsOn, out, seen);
    for (const [k, v] of Object.entries(row.refs)) out.set(k, v);
  }
  return out;
}

function authorContext(
  row: ChangesetRow,
  kind: ActorContext["kind"],
  handle: string,
): ActorContext {
  return {
    actorId: row.authorId,
    kind,
    handle,
    onBehalfOfId: row.onBehalfOfId,
    sessionId: row.sessionId,
  };
}

async function authorOf(row: ChangesetRow): Promise<ActorContext> {
  const actor = await getDb().query.actors.findFirst({ where: eq(actors.id, row.authorId) });
  return authorContext(row, actor!.kind, actor!.handle);
}

async function runOps(
  tx: Tx,
  author: ActorContext,
  changesetId: string,
  ops: StoredOp[],
): Promise<ApplyState> {
  const state: ApplyState = {
    tx,
    author,
    changesetId,
    outcomes: [],
    excerptChecks: [],
    touchedClaims: new Set(),
    baseVersions: new Map(),
  };
  await applyOps(state, ops);
  return state;
}

export async function proposeChangeset(
  ctx: ActorContext,
  raw: ChangesetInputRaw,
): Promise<ProposalResult> {
  const input = ChangesetInput.parse(raw);
  const chain = await pendingChain(input.dependsOn);

  // Refs visible to this changeset: those of everything it depends on, then its own.
  const refs = await transitiveRefs(input.dependsOn);
  const own: Record<string, string> = {};
  const withIds: StoredOp[] = input.ops.map((op, index) => {
    if (!createdKind(op)) return op;
    const id = uuidv7();
    const name = "ref" in op ? op.ref : undefined;
    if (name) {
      if (own[name]) throw new ValidationError(`op #${index}: ref "${name}" is declared twice`);
      own[name] = id;
      refs.set(name, id);
    }
    return { ...op, id };
  });
  const ops = resolveRefs(withIds, refs);

  const id = uuidv7();
  const row = {
    id,
    status: "proposed" as const,
    title: input.title,
    rationale: input.rationale,
    ops: ops as ChangeOp[],
    refs: own,
    dependsOn: input.dependsOn,
    authorId: ctx.actorId,
    onBehalfOfId: ctx.onBehalfOfId,
    sessionId: ctx.sessionId,
  };
  const dryRun: { report?: ChangesetReport; baseVersions?: Map<number, number> } = {};
  try {
    await getDb().transaction(async (tx) => {
      for (const dep of chain) await runOps(tx, await authorOf(dep), dep.id, dep.ops as StoredOp[]);
      // The row must exist for foreign keys (page revisions) during the dry run.
      await tx.insert(changesets).values(row);
      const state = await runOps(tx, ctx, id, ops);
      const claims = [...(await evidenceFor(tx, [...state.touchedClaims])).values()];
      dryRun.report = { outcomes: state.outcomes, excerptChecks: state.excerptChecks, claims };
      dryRun.baseVersions = state.baseVersions;
      throw new DryRunRollback();
    });
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error;
  }
  const report = dryRun.report;
  if (!report) throw new Error("dry run produced no report");

  // Pin each update to the version it was checked against, so a stale edit
  // fails at approval instead of silently overwriting a later change.
  const pinned = ops.map((op, i) => {
    const base = dryRun.baseVersions?.get(i);
    return base !== undefined && (op as { baseVersion?: number }).baseVersion === undefined
      ? { ...op, baseVersion: base }
      : op;
  });

  await getDb().transaction(async (tx) => {
    await tx
      .insert(changesets)
      .values({
        ...row,
        ops: pinned as ChangeOp[],
        report: report as unknown as Record<string, unknown>,
      });
    await recordEvent(tx, ctx, {
      action: "changeset.proposed",
      subjectType: "changeset",
      subjectId: id,
      changesetId: id,
      rationale: input.rationale,
      data: { title: input.title, ops: ops.length, dependsOn: input.dependsOn },
    });
  });
  return { id, status: "proposed", refs: own, report };
}

export interface DecisionResult {
  id: string;
  status: ChangesetStatus;
  error?: string;
  applied?: string[];
}

/** Approve and apply. With `withDependencies`, pending dependencies are approved first, in order. */
export async function approveChangeset(
  ctx: ActorContext,
  id: string,
  options: {
    note?: string;
    withDependencies?: boolean;
    allowSystem?: boolean;
    /** An agent approving under the human's standing delegation (see delegation.ts). */
    delegated?: boolean;
  } = {},
): Promise<DecisionResult> {
  let note = options.note;
  if (options.delegated && ctx.kind !== "human") {
    const delegation = ctx.onBehalfOfId ? await activeApprovalDelegation(ctx.onBehalfOfId) : null;
    if (!delegation)
      throw new PermissionError(
        `"${ctx.handle}" may approve only under an active approval delegation from the user`,
      );
    note = `Approved by ${ctx.handle} on the user's behalf, under the standing instruction of ${delegation.at.toISOString().slice(0, 16).replace("T", " ")} UTC (“${delegation.instruction}”).${note ? ` ${note}` : ""}`;
  } else if (!(options.allowSystem && ctx.kind === "system")) {
    requireEditor(ctx, "approving a changeset");
  }
  const row = await loadChangeset(id);
  if (!OPEN.includes(row.status))
    throw new ValidationError(`changeset ${id} is ${row.status}, not proposed`);
  const pendingDeps = await pendingChain(row.dependsOn);
  if (pendingDeps.length && !options.withDependencies) {
    throw new ValidationError(
      `approve its dependencies first: ${pendingDeps.map((d) => d.id).join(", ")}`,
    );
  }
  const applied: string[] = [];
  for (const target of [...pendingDeps, row]) {
    const author = await authorOf(target);
    try {
      await getDb().transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(changesets)
          .where(eq(changesets.id, target.id))
          .for("update");
        if (!locked || !OPEN.includes(locked.status))
          throw new StatusGuardError(`changeset ${target.id} is ${locked?.status ?? "missing"}`);
        await runOps(tx, author, target.id, target.ops as StoredOp[]);
        const now = new Date();
        await tx
          .update(changesets)
          .set({
            status: "applied",
            decidedById: ctx.actorId,
            decidedAt: now,
            appliedAt: now,
            decisionNote: note ?? null,
            error: null,
          })
          .where(eq(changesets.id, target.id));
        await recordEvent(tx, ctx, {
          action: "changeset.applied",
          subjectType: "changeset",
          subjectId: target.id,
          changesetId: target.id,
          rationale: note,
          data: {
            title: target.title,
            author: author.handle,
            ops: target.ops.length,
            ...(options.delegated && ctx.kind !== "human" ? { delegated: true } : {}),
          },
        });
      });
      applied.push(target.id);
    } catch (error) {
      // Someone else decided it meanwhile (another tab, a withdrawal): leave its status alone.
      if (error instanceof StatusGuardError) throw error;
      const message =
        error instanceof OpError || error instanceof ValidationError
          ? error.message
          : String(error);
      await getDb().transaction(async (tx) => {
        const updated = await tx
          .update(changesets)
          .set({ status: "failed", error: message })
          .where(and(eq(changesets.id, target.id), inArray(changesets.status, OPEN)))
          .returning({ id: changesets.id });
        if (!updated.length) return;
        await recordEvent(tx, ctx, {
          action: "changeset.failed",
          subjectType: "changeset",
          subjectId: target.id,
          changesetId: target.id,
          data: { error: message },
        });
      });
      return { id: target.id, status: "failed", error: message, applied };
    }
  }
  return { id, status: "applied", applied };
}

export async function rejectChangeset(
  ctx: ActorContext,
  id: string,
  note: string,
): Promise<DecisionResult> {
  requireEditor(ctx, "rejecting a changeset");
  return closeChangeset(ctx, id, "rejected", note);
}

/** The author (or the human they act for) withdraws a proposal. */
export async function withdrawChangeset(
  ctx: ActorContext,
  id: string,
  note?: string,
): Promise<DecisionResult> {
  const row = await loadChangeset(id);
  const allowed =
    row.authorId === ctx.actorId || row.onBehalfOfId === ctx.actorId || ctx.kind === "human";
  if (!allowed) throw new ValidationError("only the author can withdraw a changeset");
  return closeChangeset(ctx, id, "withdrawn", note);
}

async function closeChangeset(
  ctx: ActorContext,
  id: string,
  status: "rejected" | "withdrawn",
  note?: string,
): Promise<DecisionResult> {
  return getDb().transaction(async (tx) => {
    // Conditional on status, under a row lock: never overwrite an approval in flight.
    const updated = await tx
      .update(changesets)
      .set({ status, decidedById: ctx.actorId, decidedAt: new Date(), decisionNote: note ?? null })
      .where(and(eq(changesets.id, id), inArray(changesets.status, OPEN)))
      .returning({ id: changesets.id });
    if (!updated.length) {
      const row = await loadChangeset(id);
      throw new ValidationError(`changeset ${id} is ${row.status}, not proposed`);
    }
    await recordEvent(tx, ctx, {
      action: `changeset.${status}`,
      subjectType: "changeset",
      subjectId: id,
      changesetId: id,
      rationale: note,
    });
    return { id, status };
  });
}

export interface ChangesetView {
  id: string;
  status: ChangesetStatus;
  title: string;
  rationale: string;
  ops: ChangeOp[];
  refs: Record<string, string>;
  dependsOn: string[];
  report: ChangesetReport;
  author: { handle: string; kind: string; displayName: string };
  onBehalfOf: { handle: string; displayName: string } | null;
  sessionId: string | null;
  createdAt: Date;
  decidedBy: { handle: string; displayName: string; kind: string } | null;
  /** Approved by an agent for the user, under their standing instruction (not by the user themselves). */
  delegated: boolean;
  decidedAt: Date | null;
  decisionNote: string | null;
  error: string | null;
}

export async function listChangesets(
  filter: { status?: ChangesetStatus[]; limit?: number } = {},
): Promise<ChangesetView[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(changesets)
    .where(filter.status?.length ? inArray(changesets.status, filter.status) : undefined)
    .orderBy(desc(changesets.id))
    .limit(Math.min(filter.limit ?? 50, 200));
  return toViews(rows);
}

export async function getChangeset(id: string): Promise<ChangesetView> {
  const [view] = await toViews([await loadChangeset(id)]);
  return view!;
}

async function toViews(rows: ChangesetRow[]): Promise<ChangesetView[]> {
  const actorRows = await getDb().select().from(actors);
  const byId = new Map(actorRows.map((a) => [a.id, a]));
  const person = (id: string | null) => {
    const a = id ? byId.get(id) : undefined;
    return a ? { handle: a.handle, displayName: a.displayName } : null;
  };
  const decider = (id: string | null) => {
    const a = id ? byId.get(id) : undefined;
    return a ? { handle: a.handle, displayName: a.displayName, kind: a.kind } : null;
  };
  return rows.map((r) => {
    const author = byId.get(r.authorId)!;
    return {
      id: r.id,
      status: r.status,
      title: r.title,
      rationale: r.rationale,
      ops: r.ops,
      refs: r.refs,
      dependsOn: r.dependsOn,
      report: r.report as unknown as ChangesetReport,
      author: { handle: author.handle, kind: author.kind, displayName: author.displayName },
      onBehalfOf: person(r.onBehalfOfId),
      sessionId: r.sessionId,
      createdAt: r.createdAt,
      decidedBy: decider(r.decidedById),
      delegated:
        r.status === "applied" &&
        Boolean(r.decidedById && byId.get(r.decidedById)?.kind !== "human"),
      decidedAt: r.decidedAt,
      decisionNote: r.decisionNote,
      error: r.error,
    };
  });
}
