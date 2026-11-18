import {
  aggregate,
  claimIdsInBlock,
  isUuid,
  MIN_GROUP,
  surenessOf,
  type Aggregate,
  type Block,
  type VerificationLevel,
} from "@pramana/core";
import { actors, cards, changesets, claims, getDb, learnerResponses, reviewLogs, sources } from "@pramana/db";
import { asc, inArray } from "drizzle-orm";
import { getPageView, listPages, type ClaimCard } from "./queries";

/**
 * Public insights: how well the content is sourced, who changes it, and how
 * learners as a group answer its questions. Content statistics are exact.
 * Learning statistics are aggregates over learners, withheld below
 * MIN_GROUP distinct learners (see `aggregate` in @pramana/core); counts of
 * responses are always shown, per-person answers never. Test accounts
 * (handles starting "test-") are left out of learning statistics.
 */

type ByLevel = Record<VerificationLevel, number>;
const emptyLevels = (): ByLevel => ({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });
type Tier = "primary" | "secondary" | "tertiary" | "none";
const emptyTiers = (): Record<Tier, number> => ({ primary: 0, secondary: 0, tertiary: 0, none: 0 });

export interface EvidenceRow {
  claims: number;
  byLevel: ByLevel;
  /** The best tier among each claim's evidential (non-"mentions") citations. */
  byTier: Record<Tier, number>;
  /** Claims resting only on tertiary sources (encyclopedias). */
  tertiaryOnly: number;
  /** Excerpts cited, by quote check status (exact, fuzzy, no_quote = locator only…). */
  quotes: Record<string, number>;
  /**
   * Evidential citations by support check (ai_supports, ai_partial,
   * ai_unsupported, human_*, unchecked); "no_quote" for unchecked citations
   * that have no quote to judge; "stale" for judgments that no longer apply
   * because the claim, quote or stance has changed since.
   */
  support: Record<string, number>;
  /** Claims with a joint support check, by status, or "stale" if the claim has changed since. */
  joint: Record<string, number>;
}

export interface ThinChapter {
  page: string;
  chapterId: string;
  title: string;
  claims: number;
  /** Claims below L2 (quote not found in a stored source) or resting only on tertiary sources. */
  thin: number;
}

export interface Insights {
  generatedAt: Date;
  minGroup: number;
  evidence: {
    total: EvidenceRow;
    pages: (EvidenceRow & { slug: string; title: string })[];
    /** Chapters where at least a third of the claims are thin, thinnest first. */
    thinChapters: ThinChapter[];
    sources: { total: number; byTier: Record<string, number>; byKind: Record<string, number>; byLicence: Record<string, number> };
  };
  changes: {
    total: number;
    /** Changesets by the kind of actor who proposed them, and what became of them. */
    byAuthor: { kind: string; total: number; byStatus: Record<string, number> }[];
    /** Applied or rejected changesets, by the kind of actor who decided. */
    decidedBy: Record<string, number>;
    /** Ops in changesets, by month proposed and op type. */
    opsByMonth: { month: string; op: string; count: number }[];
  };
  learning: {
    /** Learners with any recorded activity (test accounts excluded). */
    learners: number;
    beliefs: { claimId: string; text: string; page: string; answers: Aggregate<{ yes: number; no: number; unsure: number }> }[];
    guesses: { page: string; blockId: string; question: string; answers: Aggregate<{ right: number; close: number }> }[];
    /** Answers given as "sure", and the share of them that were wrong (reviews, checks, guesses). */
    confidentErrors: Aggregate<{ sure: number; wrong: number }>;
    /** Claims with review cards, by total FSRS lapses (forgotten after being learned). */
    hardest: { claimId: string; text: string; reviews: Aggregate<{ lapses: number; learnersLapsed: number }> }[];
    /** Claims whose review data come from fewer than MIN_GROUP learners. */
    hardestWithheld: number;
  };
}

function tierOf(c: ClaimCard): Tier {
  const ev = c.citations.filter((x) => x.stance !== "mentions").map((x) => x.excerpt.source.tier);
  if (ev.includes("primary")) return "primary";
  if (ev.includes("secondary")) return "secondary";
  if (ev.includes("tertiary")) return "tertiary";
  return "none";
}

const isThin = (c: ClaimCard) => c.level < 2 || c.issues.some((i) => i.code === "tertiary_only");

function evidenceRow(cs: ClaimCard[]): EvidenceRow {
  const row: EvidenceRow = { claims: cs.length, byLevel: emptyLevels(), byTier: emptyTiers(), tertiaryOnly: 0, quotes: {}, support: {}, joint: {} };
  const seen = new Set<string>();
  for (const c of cs) {
    row.byLevel[c.level]++;
    row.byTier[tierOf(c)]++;
    if (c.issues.some((i) => i.code === "tertiary_only")) row.tertiaryOnly++;
    if (c.jointSupport) {
      const k = c.jointSupport.state === "stale" ? "stale" : c.jointSupport.status;
      row.joint[k] = (row.joint[k] ?? 0) + 1;
    }
    for (const x of c.citations) {
      if (x.stance === "mentions") continue;
      const k =
        x.supportCheck.state === "stale"
          ? "stale"
          : x.supportCheck.status === "unchecked" && !x.excerpt.quote
            ? "no_quote"
            : x.supportCheck.status;
      row.support[k] = (row.support[k] ?? 0) + 1;
    }
    for (const x of c.citations) {
      if (seen.has(x.excerpt.id)) continue;
      seen.add(x.excerpt.id);
      const s = x.excerpt.verification.status;
      row.quotes[s] = (row.quotes[s] ?? 0) + 1;
    }
  }
  return row;
}

function count<T>(xs: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[key(x)] = (out[key(x)] ?? 0) + 1;
  return out;
}

const month = (d: Date) => d.toISOString().slice(0, 7);

export async function getInsights(): Promise<Insights> {
  const db = getDb();
  const [pageList, actorRows] = await Promise.all([listPages(), db.select().from(actors)]);
  const kindOf = new Map(actorRows.map((a) => [a.id, a.kind as string]));
  const isTest = new Set(actorRows.filter((a) => a.handle.startsWith("test-")).map((a) => a.id));

  // ------------------------------------------------------------ evidence
  const allClaims = new Map<string, ClaimCard>();
  const pageRows: Insights["evidence"]["pages"] = [];
  const thinChapters: ThinChapter[] = [];
  const blocksByPage = new Map<string, { slug: string; blocks: Block[] }>();
  for (const p of pageList.filter((x) => x.kind !== "overview")) {
    const view = await getPageView(p.id).catch(() => null);
    if (!view) continue;
    const cs = Object.values(view.claims);
    if (!cs.length) continue;
    cs.forEach((c) => allClaims.set(c.id, c));
    pageRows.push({ slug: p.slug, title: p.title, ...evidenceRow(cs) });
    blocksByPage.set(p.id, { slug: p.slug, blocks: view.page.blocks });
    let current: ThinChapter | null = null;
    let ids = new Set<string>();
    const close = () => {
      if (!current) return;
      const chapterClaims = [...ids].map((id) => view.claims[id]).filter((c): c is ClaimCard => Boolean(c));
      current.claims = chapterClaims.length;
      current.thin = chapterClaims.filter(isThin).length;
      if (current.claims > 0 && current.thin * 3 >= current.claims) thinChapters.push(current);
    };
    for (const b of view.page.blocks) {
      if (b.type === "chapter") {
        close();
        current = { page: p.slug, chapterId: b.id, title: b.title, claims: 0, thin: 0 };
        ids = new Set();
      } else if (current) claimIdsInBlock(b).forEach((id) => ids.add(id));
    }
    close();
  }
  thinChapters.sort((a, b) => b.thin / b.claims - a.thin / a.claims || b.thin - a.thin);
  const sourceRows = await db.select({ kind: sources.kind, tier: sources.tier, license: sources.license }).from(sources);

  // ------------------------------------------------------------- changes
  const csRows = await db
    .select({ status: changesets.status, authorId: changesets.authorId, decidedById: changesets.decidedById, ops: changesets.ops, createdAt: changesets.createdAt })
    .from(changesets)
    .orderBy(asc(changesets.createdAt));
  const byAuthor = new Map<string, { kind: string; total: number; byStatus: Record<string, number> }>();
  const decidedBy: Record<string, number> = {};
  const ops = new Map<string, number>();
  for (const c of csRows) {
    const kind = kindOf.get(c.authorId) ?? "unknown";
    const row = byAuthor.get(kind) ?? { kind, total: 0, byStatus: {} };
    row.total++;
    row.byStatus[c.status] = (row.byStatus[c.status] ?? 0) + 1;
    byAuthor.set(kind, row);
    if (c.decidedById && (c.status === "applied" || c.status === "rejected")) {
      const k = kindOf.get(c.decidedById) ?? "unknown";
      decidedBy[k] = (decidedBy[k] ?? 0) + 1;
    }
    for (const op of c.ops) {
      const key = `${month(c.createdAt)}|${op.op}`;
      ops.set(key, (ops.get(key) ?? 0) + 1);
    }
  }

  // ------------------------------------------------------------ learning
  const responses = (await db.select().from(learnerResponses).orderBy(asc(learnerResponses.at))).filter((r) => !isTest.has(r.actorId));
  const cardRows = (await db.select({ id: cards.id, actorId: cards.actorId, claimId: cards.claimId, fsrs: cards.fsrs }).from(cards)).filter(
    (c) => !isTest.has(c.actorId),
  );
  const logs = (await db.select({ actorId: reviewLogs.actorId, confidence: reviewLogs.confidence, correct: reviewLogs.correct }).from(reviewLogs)).filter(
    (l) => !isTest.has(l.actorId),
  );
  const learners = new Set([...responses.map((r) => r.actorId), ...cardRows.map((c) => c.actorId), ...logs.map((l) => l.actorId)]);
  const pageSlug = new Map([...blocksByPage].map(([id, p]) => [id, p.slug]));

  // Beliefs: each learner's latest answer per misconception.
  const beliefGroups = new Map<string, { page: string; responses: number; latest: Map<string, string> }>();
  for (const r of responses) {
    if (r.kind !== "belief" || !r.claimId) continue;
    const g = beliefGroups.get(r.claimId) ?? { page: pageSlug.get(r.pageId ?? "") ?? "", responses: 0, latest: new Map() };
    g.responses++;
    g.latest.set(r.actorId, String((r.response as { belief?: unknown }).belief));
    beliefGroups.set(r.claimId, g);
  }
  const claimText = new Map<string, string>();
  const textIds = [...new Set([...beliefGroups.keys(), ...cardRows.map((c) => c.claimId)])].filter(isUuid);
  if (textIds.length) for (const c of await db.select({ id: claims.id, text: claims.text }).from(claims).where(inArray(claims.id, textIds))) claimText.set(c.id, c.text);
  const beliefs = [...beliefGroups].map(([claimId, g]) => ({
    claimId,
    text: claimText.get(claimId) ?? "",
    page: g.page,
    answers: aggregate(g.responses, g.latest.size, () => {
      const v = { yes: 0, no: 0, unsure: 0 };
      for (const b of g.latest.values()) if (b === "yes" || b === "no" || b === "unsure") v[b]++;
      return v;
    }),
  }));

  // Guesses: first guess per learner per question.
  const guessGroups = new Map<string, { page: string; pageId: string; blockId: string; first: Map<string, { correct: boolean; close: boolean }>; responses: number }>();
  for (const r of responses) {
    if (r.kind !== "guess" || !r.pageId) continue;
    const key = `${r.pageId}|${r.blockId}`;
    const g = guessGroups.get(key) ?? { page: pageSlug.get(r.pageId) ?? "", pageId: r.pageId, blockId: r.blockId, first: new Map(), responses: 0 };
    g.responses++;
    if (!g.first.has(r.actorId)) g.first.set(r.actorId, { correct: r.correct === 1, close: Boolean((r.result as { close?: boolean } | null)?.close) });
    guessGroups.set(key, g);
  }
  const guesses = [...guessGroups.values()].map((g) => {
    const block = blocksByPage.get(g.pageId)?.blocks.find((b) => b.id === g.blockId);
    return {
      page: g.page,
      blockId: g.blockId,
      question: block?.type === "guess" ? block.question : g.blockId,
      answers: aggregate(g.responses, g.first.size, () => ({
        right: [...g.first.values()].filter((x) => x.correct).length,
        close: [...g.first.values()].filter((x) => x.close && !x.correct).length,
      })),
    };
  });

  // Sure and wrong, across reviews, checks and guesses.
  const sureAnswers = [
    ...logs.filter((l) => l.correct !== null && l.confidence !== null && surenessOf(l.confidence) === "high").map((l) => ({ actor: l.actorId, wrong: l.correct === 0 })),
    ...responses
      .filter((r) => (r.kind === "guess" || (r.kind === "check" && r.claimId === null) || r.kind === "first") && r.confidence !== null && surenessOf(r.confidence) === "high")
      .map((r) => ({ actor: r.actorId, wrong: r.correct === 0 })),
  ];
  const confidentErrors = aggregate(sureAnswers.length, new Set(sureAnswers.map((a) => a.actor)).size, () => ({
    sure: sureAnswers.length,
    wrong: sureAnswers.filter((a) => a.wrong).length,
  }));

  // Hardest claims: FSRS lapses, summed over learners.
  const byClaim = new Map<string, { learners: Set<string>; lapses: number; lapsed: Set<string>; reps: number }>();
  for (const c of cardRows) {
    const f = c.fsrs as { lapses?: number; reps?: number };
    const g = byClaim.get(c.claimId) ?? { learners: new Set(), lapses: 0, lapsed: new Set(), reps: 0 };
    g.learners.add(c.actorId);
    g.lapses += f.lapses ?? 0;
    g.reps += f.reps ?? 0;
    if ((f.lapses ?? 0) > 0) g.lapsed.add(c.actorId);
    byClaim.set(c.claimId, g);
  }
  const reviewed = [...byClaim].filter(([, g]) => g.reps > 0);
  const shown = reviewed.filter(([, g]) => g.learners.size >= MIN_GROUP);
  const hardest = shown
    .sort(([, a], [, b]) => b.lapses - a.lapses)
    .slice(0, 10)
    .map(([claimId, g]) => ({
      claimId,
      text: claimText.get(claimId) ?? "",
      reviews: aggregate(g.reps, g.learners.size, () => ({ lapses: g.lapses, learnersLapsed: g.lapsed.size })),
    }));

  return {
    generatedAt: new Date(),
    minGroup: MIN_GROUP,
    evidence: {
      total: evidenceRow([...allClaims.values()]),
      pages: pageRows,
      thinChapters: thinChapters.slice(0, 12),
      sources: {
        total: sourceRows.length,
        byTier: count(sourceRows, (s) => s.tier),
        byKind: count(sourceRows, (s) => s.kind),
        byLicence: count(sourceRows, (s) => s.license?.status ?? "unknown"),
      },
    },
    changes: {
      total: csRows.length,
      byAuthor: [...byAuthor.values()].sort((a, b) => b.total - a.total),
      decidedBy,
      opsByMonth: [...ops].map(([k, n]) => {
        const [m, op] = k.split("|") as [string, string];
        return { month: m, op, count: n };
      }),
    },
    learning: {
      learners: learners.size,
      beliefs: beliefs.sort((a, b) => b.answers.responses - a.answers.responses),
      guesses: guesses.sort((a, b) => b.answers.responses - a.answers.responses),
      confidentErrors,
      hardest,
      hardestWithheld: reviewed.length - shown.length,
    },
  };
}

