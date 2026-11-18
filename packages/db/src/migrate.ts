import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "./client";

const here = dirname(fileURLToPath(import.meta.url));
await migrate(getDb(), { migrationsFolder: join(here, "..", "migrations") });
await closeDb();
console.log("migrations applied");
