import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as svc from "@pramana/services";
import { z } from "zod";
import { type Ctx, READ, run } from "./tool-kit";

/** Learning tools that read the user's own state, for quizzing and for tailoring a page to them. */
export function registerLearnTools(server: McpServer, ctx: Ctx): void {
  server.registerTool(
    "learner_signals",
    {
      title: "What the user knows, has forgotten or confused",
      description:
        'Claim by claim and part by part, the user\'s own learning state, optionally for one page. Each claim met has a state: confused (sure and wrong and not yet put right, or a misconception believed before reading), forgotten (wrong at the last review after once remembering it), shaky, met (answered or in the deck, not yet reviewed) or known; with plain-word reasons ("sure and wrong on 18 Oct"), its page and part. Each part has untouched | begun | shaky | solid, how far off the first guess was, and check answers right and wrong. Use it to choose what to explain again, what to quiz, and what a tailored view of a page should bring forward. Explain from the claim and its sources (get_claim), never from memory.',
      inputSchema: { page: z.string().optional() },
      annotations: READ,
    },
    run(ctx, async (a: { page?: string }, actor) => svc.learnerSignals(actor, { page: a.page })),
  );

  server.registerTool(
    "todays_session",
    {
      title: "Today's study session",
      description:
        "What /learn/today would give the user now: the next part to study (page, part, title), its guess-first question if not yet answered (ask it before saying anything about the part; record with record_guess), its end-of-part check (questions from chapter_questions; record with record_check_answer), and how many cards are due today (quiz with due_reviews, record with record_review).",
      annotations: READ,
    },
    run(ctx, async (_a: unknown, actor) => svc.todaysSession(actor)),
  );
}
