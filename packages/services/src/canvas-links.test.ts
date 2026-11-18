import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, connection, getDb, loadRootEnv } from "@pramana/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addCanvasItems, addCanvasLinks, createCanvas, getCanvas, humanContext, type ActorContext } from "./index";

/**
 * A line between two canvas items is drawn once: asking for it again returns the line already there.
 * Runs in a scratch database of its own (created and dropped here; never the main or preview DB).
 * Skipped when Postgres is not running.
 */
const TEST_DB = "pramana_canvas_links_test";
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

describe.skipIf(!reachable)("canvas links", () => {
  let me: ActorContext;
  let canvasId: string;
  let a: string;
  let b: string;
  const previousHandle = process.env.PRAMANA_USER_HANDLE;

  beforeAll(async () => {
    await admin(async (sql) => {
      await sql.unsafe(`drop database if exists ${TEST_DB} with (force)`);
      await sql.unsafe(`create database ${TEST_DB}`);
    });
    process.env.DATABASE_URL = urlFor(TEST_DB);
    const here = dirname(fileURLToPath(import.meta.url));
    await migrate(getDb(), { migrationsFolder: join(here, "..", "..", "db", "migrations") });
    process.env.PRAMANA_USER_HANDLE = "test-canvas-links";
    process.env.PRAMANA_USER_NAME = "test-canvas-links";
    me = await humanContext();
    canvasId = (await createCanvas(me, { title: "Links" })).id;
    [a, b] = (
      await addCanvasItems(me, canvasId, {
        items: [
          { content: { kind: "text", markdown: "One" } },
          { content: { kind: "text", markdown: "Two" } },
        ],
      })
    ).ids as [string, string];
  }, 120_000);

  afterAll(async () => {
    await closeDb();
    await admin((sql) => sql.unsafe(`drop database if exists ${TEST_DB} with (force)`));
    process.env.PRAMANA_USER_HANDLE = previousHandle;
  }, 60_000);

  it("returns the line already drawn instead of drawing it twice", async () => {
    const first = await addCanvasLinks(me, canvasId, [{ from: a, to: b, relation: "supports" }]);
    const again = await addCanvasLinks(me, canvasId, [{ from: a, to: b, relation: "supports" }]);
    expect(again.ids).toEqual(first.ids);
    // Nothing new: the canvas is not touched.
    expect(again.version).toBe(first.version);
    expect((await getCanvas(me, canvasId)).links).toHaveLength(1);
  });

  it("draws the same pair with another relation, or the other way round, and repeats within a batch once", async () => {
    const r = await addCanvasLinks(me, canvasId, [
      { from: a, to: b, relation: "contradicts" },
      { from: b, to: a, relation: "supports" },
      { from: a, to: b, relation: "contradicts" },
    ]);
    expect(new Set(r.ids).size).toBe(2);
    expect(r.ids[0]).toBe(r.ids[2]);
    expect((await getCanvas(me, canvasId)).links).toHaveLength(3);
  });
});
