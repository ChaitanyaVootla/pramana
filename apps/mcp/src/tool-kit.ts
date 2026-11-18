import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as svc from "@pramana/services";
import { z } from "zod";

// Shared by every tool file (tools.ts and each area's <area>-tools.ts, registered from registerTools).

export type Ctx = () => Promise<svc.ActorContext>;

/** The web app links point at (over HTTP: the server the client connected to). */
export const webUrl = () =>
  (process.env.PRAMANA_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function text(value: unknown): CallToolResult {
  return {
    content: [
      { type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 1) },
    ],
  };
}

export function failure(error: unknown): CallToolResult {
  let message: string;
  if (error instanceof z.ZodError) message = `Invalid input:\n${z.prettifyError(error)}`;
  else if (error instanceof Error) message = `${error.name}: ${error.message}`;
  else message = String(error);
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Wraps a handler: lazily starts the session, records liveness, turns errors into tool errors. */
export function run<A>(ctx: Ctx, fn: (args: A, actor: svc.ActorContext) => Promise<unknown>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      const actor = await ctx();
      await svc.touchSession(actor);
      const result = await fn(args, actor);
      return (result as CallToolResult)?.content ? (result as CallToolResult) : text(result);
    } catch (error) {
      return failure(error);
    }
  };
}

export const READ = { readOnlyHint: true, openWorldHint: false } as const;
export const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
export const EXTERNAL = { readOnlyHint: true, openWorldHint: true } as const;
