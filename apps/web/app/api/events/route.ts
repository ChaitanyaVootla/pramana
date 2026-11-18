import { connection } from "@pramana/db";
import { followPresence, forReader, humanContext, notesVersion, sessionsChanged } from "@pramana/services";

/**
 * Server-sent events: forwards Postgres NOTIFY messages (notes posted by an
 * agent, changesets proposed or decided, agent sessions starting, active or
 * ending) so open pages update live. Every stream starts with {"table":"hello"},
 * which carries the reader's AI presence and the notes version, and the stream
 * sends {"table":"presence", presence} whenever presence changes (computed once
 * per burst for every open stream, and when a quiet session drops out), so
 * pages never poll. Changes to personal data (notes, AI sessions, canvases,
 * views) name their owner, and reach only that learner's streams.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { sql } = connection();
  const encoder = new TextEncoder();
  let closed = false;
  let unlisten: (() => Promise<void>) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unfollow: (() => void) | null = null;

  /** Stops the heartbeat and leaves the shared listener; safe to call more than once. */
  const stop = () => {
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    unfollow?.();
    unfollow = null;
    const leave = unlisten;
    unlisten = null;
    void leave?.().catch(() => {});
  };

  const stream = new ReadableStream({
    async start(controller) {
      // A stream that has gone away must never throw inside the shared listener: postgres.js calls every
      // subscriber in turn, so one dead stream's error would stop the notification reaching the rest.
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          stop();
        }
      };
      // Who is reading: another learner's notes, sessions, canvases and views are not forwarded.
      // Without a reader, only changes that have no owner (content) are.
      const human = await humanContext().catch(() => null);
      const listener = await sql.listen("pramana", (payload) => {
        if (!forReader(payload, human?.actorId ?? null)) return;
        write(`data: ${payload}\n\n`);
        // An agent session was touched: presence is recomputed once for every open stream.
        if (payload.includes('"sessions"')) sessionsChanged();
      });
      unlisten = listener.unlisten;
      // Cancelled while the LISTEN was being set up: leave at once.
      if (closed) return stop();
      heartbeat = setInterval(() => write(": keep-alive\n\n"), 15_000);
      // Read after LISTEN is set up, so a change from here on also arrives as an event.
      const hello: Record<string, unknown> = { table: "hello" };
      try {
        if (!human) throw new Error("no reader");
        hello.notesVersion = await notesVersion(human);
        const followed = await followPresence(human.actorId, (presence) =>
          write(`data: ${JSON.stringify({ table: "presence", presence })}\n\n`),
        );
        if (closed) return followed.stop();
        unfollow = followed.stop;
        hello.presence = followed.presence;
      } catch {
        // Without them the page falls back to fetching (usePresence) and reloading notes on "hello".
      }
      write(`data: ${JSON.stringify(hello)}\n\n`);
      // No request.signal here: in Next 16 it aborts as soon as the handler returns its Response, which
      // unsubscribed every stream right after "hello". A client that goes away cancels the stream (below),
      // and a failed write (the heartbeat at the latest) unsubscribes too.
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
