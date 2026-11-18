"use client";

import { askPrompt, askQuestion, type AskSubject } from "@pramana/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PresenceGlyph } from "@/components/shell/Presence";
import { usePartnerAsk } from "./partner";
import { usePresence } from "./usePresence";

/**
 * "Ask your AI about this" (docs/visual.md §7): copies a ready-made prompt
 * naming exactly this thing, with its id, to paste into the reader's AI
 * client. Nothing is sent from here. Once per page head, and once per claim
 * in the evidence drawer. While on screen it is also offered in the study
 * partner's popover (AiPresence).
 */
export function AskAi({
  subject,
  label = "Ask your AI about this",
  detail,
  size = "sm",
  register = true,
  className,
}: {
  subject: AskSubject;
  label?: string;
  /** Said after the label, muted and cut to fit (the part or claim it is about). */
  detail?: string;
  size?: "sm" | "xs" | "default";
  /** Offer it in the partner's popover too (off for the popover's own buttons). */
  register?: boolean;
  className?: string;
}) {
  usePartnerAsk(register ? subject : null);
  const presence = usePresence();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const connected = presence?.connected ?? false;
  const prompt = askPrompt(subject);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      toast.error("Could not copy. Your browser blocked the clipboard.", { description: prompt });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (connected) {
      toast.success("Copied. Paste it into your AI.", {
        description: "Its answer will appear here beside the page.",
      });
    } else {
      toast.success("Copied. Paste it into your AI.", {
        description:
          "Your AI is not connected yet, so it cannot read the evidence or post its answer here.",
        action: { label: "Connect", onClick: () => router.push("/connect") },
      });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={copy}
      className={cn("gap-1.5", className)}
      // The ask in plain words; the copied text also tells the AI which ids and tools to use.
      title={askQuestion(subject)}
    >
      <PresenceGlyph connected={connected} className="size-3.5" />
      <span aria-live="polite" className="min-w-0 truncate">
        {copied ? "Copied" : label}
        {!copied && detail && <span className="text-ink-3">: {detail}</span>}
      </span>
    </Button>
  );
}
