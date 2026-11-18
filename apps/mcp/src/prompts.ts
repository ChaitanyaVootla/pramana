import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { ASKS, askPrompt, type AskPromptName, type NoteSubject } from "@pramana/core";
import * as svc from "@pramana/services";
import { z } from "zod";

/**
 * MCP prompts: the same asks as the web app's "Ask your AI about this" button,
 * for clients that list prompts (e.g. as slash commands).
 */
async function ask(
  ctx: () => Promise<svc.ActorContext>,
  subject: Exclude<NoteSubject, { type: "general" }>,
): Promise<GetPromptResult> {
  const s = await svc.askSubject(subject, await ctx());
  return {
    description: `Ask about ${s.label}`,
    messages: [{ role: "user", content: { type: "text", text: askPrompt(s) } }],
  };
}

/** A prompt's title and description, as /connect lists them too. */
function titled(name: AskPromptName): { title: string; description: string } {
  const ask = ASKS.find((a) => a.prompt === name)!;
  return { title: ask.title, description: ask.description };
}

export function registerPrompts(server: McpServer, ctx: () => Promise<svc.ActorContext>): void {
  server.registerPrompt(
    "explain_claim",
    {
      ...titled("explain_claim"),
      argsSchema: { id: z.uuid().describe("claim id") },
    },
    ({ id }) => ask(ctx, { type: "claim", id }),
  );
  server.registerPrompt(
    "explain_chapter",
    {
      ...titled("explain_chapter"),
      argsSchema: {
        page: z.string().describe("page slug or id"),
        chapter: z.string().describe("chapter block id"),
      },
    },
    ({ page, chapter }) => ask(ctx, { type: "page", page, chapter }),
  );
  server.registerPrompt(
    "explain_page",
    {
      ...titled("explain_page"),
      argsSchema: { page: z.string().describe("page slug or id") },
    },
    ({ page }) => ask(ctx, { type: "page", page }),
  );
  server.registerPrompt(
    "explain_entity",
    {
      ...titled("explain_entity"),
      argsSchema: { entity: z.string().describe("entity slug or id") },
    },
    ({ entity }) => ask(ctx, { type: "entity", entity }),
  );
  server.registerPrompt(
    "explain_source",
    {
      ...titled("explain_source"),
      argsSchema: { id: z.uuid().describe("source id") },
    },
    ({ id }) => ask(ctx, { type: "source", id }),
  );
  server.registerPrompt(
    "explain_canvas",
    {
      ...titled("explain_canvas"),
      argsSchema: { id: z.uuid().describe("canvas id") },
    },
    ({ id }) => ask(ctx, { type: "canvas", id }),
  );
}
