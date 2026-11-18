import { join } from "node:path";
import { configureHttp } from "@pramana/connectors";
import { loadRootEnv } from "@pramana/db";
import { dataDir } from "./snapshots";

loadRootEnv();
configureHttp({
  cacheDir: join(dataDir(), "cache"),
  contact: process.env.PRAMANA_HTTP_CONTACT || null,
});

export * from "./ask";
export * from "./audit";
export * from "./canvas";
export * from "./catalog";
export * from "./changesets";
export * from "./checks";
export * from "./context";
export * from "./evidence";
export * from "./excerpts";
export * from "./extents";
export * from "./insights";
export * from "./learning";
export * from "./live";
export * from "./media";
export * from "./local-access";
export * from "./lookup";
export * from "./notes";
export * from "./presence";
export * from "./queries";
export * from "./render";
export * from "./snapshots";
export * from "./userviews";
export { NotFoundError, ValidationError, withLooseWords } from "./util";
export type { ExcerptCheck, OpOutcome, StoredOp } from "./apply";
export * from "./delegation";
