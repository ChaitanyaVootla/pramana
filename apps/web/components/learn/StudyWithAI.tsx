"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Disclosure } from "@/components/pages/Disclosure";
import { cn } from "@/lib/utils";

export interface AiPrompt {
  id: string;
  /** What it does, in a few words: "Quiz me on what is due". */
  label: string;
  /** Why now: "19 cards due", "1 confused". */
  detail?: string;
  /** What the button copies, in plain words: "Copy a quiz request for your AI". */
  button: string;
  /** The words pasted into the AI chat, with the instructions for the AI (tool names and all). */
  prompt: string;
  /** The same request in a reader's words, without ids or tool names: what "See what it asks" shows. */
  question: string;
}

/**
 * Ready-made requests for your AI session: each copies a prompt that names
 * the Pramāṇa tools to use, so the AI quizzes, explains and records answers
 * the same way /learn does. Nothing is sent from here; "See what it asks"
 * shows the request in plain words, and the full text under it.
 */
export function StudyWithAI({ prompts, className }: { prompts: AiPrompt[]; className?: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (!prompts.length) return null;
  const copy = async (p: AiPrompt) => {
    try {
      await navigator.clipboard.writeText(p.prompt);
      setCopied(p.id);
      toast.success("Copied. Paste it into your AI chat.");
      setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 2000);
    } catch {
      toast.error("Could not copy. Open “See what it asks”, then “The full request”, and copy the words from there.");
    }
  };
  return (
    <ul className={cn("divide-y divide-rule-soft font-sans", className)}>
      {prompts.map((p) => (
        <li key={p.id} className="py-3">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="text-ui text-ink">{p.label}</p>
              {p.detail && <p className="text-sm text-ink-3 tnum">{p.detail}</p>}
            </div>
            <button
              type="button"
              onClick={() => copy(p)}
              className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-md border border-rule bg-paper px-3 text-left text-sm text-ink-2 hover:border-ink-3/60 hover:text-ink"
            >
              {copied === p.id ? (
                <Check className="size-3.5 shrink-0 text-indigo" aria-hidden />
              ) : (
                <Copy className="size-3.5 shrink-0" aria-hidden />
              )}
              {copied === p.id ? "Copied" : p.button}
            </button>
          </div>
          <Disclosure summary="See what it asks" className="mt-1" triggerClassName="text-sm text-ink-3">
            <div className="pb-1 pl-5.5">
              <p className="text-sm text-ink-2">{p.question}</p>
              <Disclosure summary="The full request, with its instructions for the AI" className="mt-1" triggerClassName="text-xs text-ink-3">
                <p className="text-xs text-ink-3 select-all">{p.prompt}</p>
              </Disclosure>
            </div>
          </Disclosure>
        </li>
      ))}
    </ul>
  );
}
