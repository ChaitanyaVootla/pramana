import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "./env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

interface Connection {
  sql: postgres.Sql;
  db: Db;
}

// Survive hot reloads in dev (Next.js) without leaking connections.
const globalForDb = globalThis as unknown as { __pramanaDb?: Connection };

export function connection(): Connection {
  if (!globalForDb.__pramanaDb) {
    const url = requireEnv("DATABASE_URL");
    const sql = postgres(url, { max: 10, onnotice: () => {} });
    globalForDb.__pramanaDb = { sql, db: drizzle(sql, { schema }) };
  }
  return globalForDb.__pramanaDb;
}

export function getDb(): Db {
  return connection().db;
}

export async function closeDb(): Promise<void> {
  const conn = globalForDb.__pramanaDb;
  globalForDb.__pramanaDb = undefined;
  await conn?.sql.end({ timeout: 5 });
}
