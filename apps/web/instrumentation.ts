/**
 * Runs once when the server starts. It must return before the server takes
 * requests, so slow work is only started here, never awaited.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { warmAtlasExtents } = await import("./lib/extents-response");
  // The places index's borders (the whole record) take seconds to build cold:
  // build and compress them in the background, so the first visitor does not wait.
  setTimeout(() => {
    void warmAtlasExtents().catch((e) =>
      console.warn("atlas warm-up skipped:", (e as Error).message),
    );
  }, 0);
}
