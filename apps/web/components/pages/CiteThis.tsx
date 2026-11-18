"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Citation } from "@/lib/cite";
import { cn } from "@/lib/utils";

/** "Cite this": the citation as plain text and as BibTeX, each with a copy button. */
export function CiteThis({
  citation,
  intro,
  className,
}: {
  citation: Citation;
  intro: string;
  className?: string;
}) {
  const [format, setFormat] = useState<"plain" | "bibtex">("plain");
  const [copied, setCopied] = useState(false);
  const text = citation[format];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast.error("Could not copy. Your browser blocked the clipboard.", { description: text });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={cn("font-sans", className)}>
      <p className="text-ui text-ink-2">{intro}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Citation format" className="flex gap-1">
          {(
            [
              ["plain", "Plain text"],
              ["bibtex", "BibTeX"],
            ] as const
          ).map(([f, label]) => (
            <Button
              key={f}
              type="button"
              size="xs"
              variant={format === f ? "secondary" : "ghost"}
              aria-pressed={format === f}
              onClick={() => setFormat(f)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      {/* Focusable, so a keyboard can scroll a long BibTeX line. */}
      <pre
        tabIndex={0}
        aria-label={format === "plain" ? "Citation, plain text" : "Citation, BibTeX"}
        className={cn(
          "field mt-2 overflow-x-auto rounded-sm px-4 py-3 leading-relaxed text-ink",
          // Plain text wraps like a sentence; BibTeX keeps its lines and scrolls sideways.
          format === "plain"
            ? "font-serif text-base break-words whitespace-pre-wrap"
            : "font-mono text-sm whitespace-pre",
        )}
      >
        {text}
      </pre>
    </div>
  );
}
