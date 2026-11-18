import { ASKS } from "@pramana/core";
import { cn } from "@/lib/utils";

/**
 * The six ready-made asks, plainly: what each gives, and where its "Ask your AI" button is. The
 * same asks are MCP prompts, so an AI app that lists prompts offers them too.
 */
export function WhatYourAiCanDo({ className }: { className?: string }) {
  return (
    <section className={cn("font-sans", className)} aria-labelledby="can-do-heading">
      <h2 id="can-do-heading" className="font-heading text-xl text-ink">
        What your AI can do here
      </h2>
      <p className="mt-1.5 text-note text-ink-2">
        Ask it anything about what you read. These six are ready-made: press{" "}
        <span className="text-ink">Ask your AI</span> where you see it, and paste what it copies
        into your AI.
      </p>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {ASKS.map((a) => (
          <li key={a.prompt} className="py-2.5 text-ui">
            <p className="text-ink">{a.title}</p>
            <p className="text-sm text-ink-2">{a.description}</p>
            <p className="text-sm text-ink-3">{a.where}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-3">
        It can also run your study session, quiz you on what is due, and lay things out on a
        canvas.
      </p>
    </section>
  );
}
