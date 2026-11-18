import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, connection, getDb, loadRootEnv, notes } from "@pramana/db";
import { uuidv7 } from "@pramana/core";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addCanvasItems,
  askSubject,
  createCanvas,
  forReader,
  getCanvas,
  getPresence,
  humanContext,
  listCanvases,
  listEvents,
  listNotes,
  noteCounts,
  notesVersion,
  postNote,
  setNoteStatus,
  startAgentSession,
  type ActorContext,
} from "./index";

/**
 * Personal data stays with its learner: two learners, each with their own AI session, in a scratch
 * database of their own (created and dropped here; never the main or preview DB). Skipped when
 * Postgres is not running.
 */
const TEST_DB = "pramana_privacy_test";
loadRootEnv();
const base = new URL(process.env.DATABASE_URL ?? "postgres://pramana:pramana@127.0.0.1:5442/pramana");
const urlFor = (db: string) => Object.assign(new URL(base), { pathname: `/${db}` }).toString();

async function admin<T>(fn: (sql: ReturnType<typeof connection>["sql"]) => Promise<T>): Promise<T> {
  process.env.DATABASE_URL = urlFor("postgres");
  try {
    return await fn(connection().sql);
  } finally {
    await closeDb();
  }
}

const reachable = await admin((sql) => sql`select 1`).then(
  () => true,
  () => false,
);

interface Learner {
  human: ActorContext;
  agent: ActorContext;
}

/** humanContext and startAgentSession act for PRAMANA_USER_HANDLE. */
async function learner(handle: string): Promise<Learner> {
  process.env.PRAMANA_USER_HANDLE = handle;
  process.env.PRAMANA_USER_NAME = handle;
  const human = await humanContext();
  const agent = await startAgentSession({ agentHandle: "claude-code", client: { name: `${handle}-client` } });
  return { human, agent };
}

describe.skipIf(!reachable)("personal data is the owner's alone", () => {
  let a: Learner;
  let b: Learner;
  const previousHandle = process.env.PRAMANA_USER_HANDLE;

  beforeAll(async () => {
    await admin(async (sql) => {
      await sql.unsafe(`drop database if exists ${TEST_DB} with (force)`);
      await sql.unsafe(`create database ${TEST_DB}`);
    });
    process.env.DATABASE_URL = urlFor(TEST_DB);
    const here = dirname(fileURLToPath(import.meta.url));
    await migrate(getDb(), { migrationsFolder: join(here, "..", "..", "db", "migrations") });
    a = await learner("test-privacy-a");
    b = await learner("test-privacy-b");
  }, 120_000);

  afterAll(async () => {
    await closeDb();
    await admin((sql) => sql.unsafe(`drop database if exists ${TEST_DB} with (force)`));
    process.env.PRAMANA_USER_HANDLE = previousHandle;
  }, 60_000);

  it("lists, counts and versions only the learner's own notes and their AI's", async () => {
    const before = await notesVersion(b.human);
    const byAgent = await postNote(a.agent, { title: "From A's AI", body: "For A." });
    const byHuman = await postNote(a.human, { title: "A's own", body: "Also A." });
    const forB = await postNote(b.agent, { title: "From B's AI", body: "For B." });

    const ids = (notes: { id: string }[]) => notes.map((n) => n.id).sort();
    expect(ids(await listNotes(a.human))).toEqual([byAgent.id, byHuman.id].sort());
    expect(ids(await listNotes(a.agent))).toEqual([byAgent.id, byHuman.id].sort());
    expect(ids(await listNotes(b.human))).toEqual([forB.id]);
    expect(ids(await listNotes(b.human, { ids: [byAgent.id], status: "all" }))).toEqual([]);

    const total = (counts: { count: number }[]) => counts.reduce((n, c) => n + c.count, 0);
    expect(total(await noteCounts(a.human))).toBe(2);
    expect(total(await noteCounts(b.human))).toBe(1);

    // A's notes never move B's version (B's page would reload for nothing).
    const afterB = await notesVersion(b.human);
    await postNote(a.agent, { title: "Another for A", body: "Still A." });
    expect(await notesVersion(b.human)).toBe(afterB);
    expect(afterB).not.toBe(before);
  });

  it("does not let another learner, or their AI, change a note", async () => {
    const note = await postNote(a.agent, { title: "Keep me", body: "A's." });
    await expect(setNoteStatus(b.human, note.id, "archived")).rejects.toThrow(/not found/);
    await expect(setNoteStatus(b.agent, note.id, "archived")).rejects.toThrow(/not found/);
    await setNoteStatus(a.human, note.id, "pinned");
    expect((await listNotes(a.human, { ids: [note.id] }))[0]?.status).toBe("pinned");
  });

  it("keeps canvases, and notes about them, with their owner", async () => {
    const canvas = await createCanvas(a.human, { title: "A's board" });
    expect((await listCanvases(b.human)).map((c) => c.id)).not.toContain(canvas.id);
    await expect(getCanvas(b.human, canvas.id)).rejects.toThrow(/not found/);
    await expect(getCanvas(b.agent, canvas.id)).rejects.toThrow(/not found/);

    // B's AI can't post about A's canvas, or learn its title from a prompt.
    await expect(
      postNote(b.agent, { title: "Snoop", body: "x", about: { type: "canvas", id: canvas.id } }),
    ).rejects.toThrow(/not found/);
    await expect(askSubject({ type: "canvas", id: canvas.id }, b.agent)).rejects.toThrow(/not found/);
    expect((await askSubject({ type: "canvas", id: canvas.id }, a.agent)).label).toBe("A's board");

    const about = await postNote(a.agent, { title: "How it connects", body: "y", about: { type: "canvas", id: canvas.id } });
    expect((await getCanvas(a.human, canvas.id)).notes.map((n) => n.id)).toEqual([about.id]);

    // A note is placed only on its owner's canvas.
    const mine = await createCanvas(b.human, { title: "B's board" });
    await expect(
      addCanvasItems(b.agent, mine.id, { items: [{ content: { kind: "note", noteId: about.id } }] }),
    ).rejects.toThrow(/note/);
    const own = await postNote(b.agent, { title: "B's", body: "z" });
    await addCanvasItems(b.agent, mine.id, { items: [{ content: { kind: "note", noteId: own.id } }] });
    const items = (await getCanvas(b.human, mine.id)).items;
    expect(items.map((i) => (i.data.kind === "note" ? i.data.note.id : null))).toEqual([own.id]);
  });

  it("shows only the learner's own AI sessions as present", async () => {
    // A session counts as present once it is seen.
    expect((await getPresence(b.human.actorId)).sessions.map((s) => s.id)).toEqual([b.agent.sessionId]);
    expect((await getPresence(a.human.actorId)).sessions.map((s) => s.id)).toEqual([a.agent.sessionId]);
  });

  it("names the owner in live notifications, so each learner's stream gets only theirs", async () => {
    const got: string[] = [];
    const { unlisten } = await connection().sql.listen("pramana", (p) => void got.push(p));
    const note = await postNote(a.agent, { title: "Live", body: "A's." });
    const canvas = await createCanvas(b.human, { title: "Live board" });
    await new Promise((r) => setTimeout(r, 300));
    await unlisten();
    const noteEvent = got.find((p) => p.includes(note.id))!;
    const canvasEvent = got.find((p) => p.includes(canvas.id))!;
    expect(JSON.parse(noteEvent)).toMatchObject({ table: "notes", owner: a.human.actorId });
    expect(JSON.parse(canvasEvent)).toMatchObject({ table: "canvases", owner: b.human.actorId });
    expect(forReader(noteEvent, a.human.actorId)).toBe(true);
    expect(forReader(noteEvent, b.human.actorId)).toBe(false);
    expect(forReader(canvasEvent, a.human.actorId)).toBe(false);
    expect(forReader(noteEvent, null)).toBe(false);
    expect(forReader('{"table":"changesets","id":"x","op":"INSERT"}', b.human.actorId)).toBe(true);
  });

  it("posts the same note once, and lists an old repeat once", async () => {
    const first = await postNote(a.agent, { title: "Twice", body: "Same words." });
    const again = await postNote(a.agent, { title: "Twice", body: "Same words." });
    expect(again.id).toBe(first.id);
    // A repeat from before posting was idempotent: written straight to the table.
    const row = (await getDb().select().from(notes).where(eq(notes.id, first.id)))[0]!;
    await getDb().insert(notes).values({ ...row, id: uuidv7() });
    const titled = (await listNotes(a.human)).filter((n) => n.title === "Twice");
    expect(titled.map((n) => n.id)).toHaveLength(1);
  });

  it("does not count a script that runs by itself as the reader's AI", async () => {
    const pipeline = await startAgentSession({ client: { name: "pipeline" }, meta: { automation: "pipeline" } });
    expect(pipeline.onBehalfOfId).toBe(b.human.actorId);
    const present = (await getPresence(b.human.actorId)).sessions.map((s) => s.id);
    expect(present).not.toContain(pipeline.sessionId);
  });

  it("keeps a learner's events out of everyone else's history", async () => {
    const note = await postNote(a.agent, { title: "Private", body: "A's." });
    const seen = async (viewer?: string) =>
      (await listEvents({ subjectId: note.id, viewer })).map((e) => e.action);
    expect(await seen(a.human.actorId)).toEqual(["note.posted"]);
    expect(await seen(b.human.actorId)).toEqual([]);
    // Content histories (no viewer) show no one's study or workspace events.
    expect(await seen()).toEqual([]);
  });
});
