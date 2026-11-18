"use client";

import { surenessOf, type Sureness } from "@pramana/core";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { SURENESS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const LEVELS: Sureness[] = ["low", "medium", "high"];

/**
 * Arrow keys move between the options of a radio group (the ARIA radio
 * pattern); Tab leaves the group. Put it on the element with role="radiogroup".
 */
export function radioArrows(e: React.KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const radios = [
    ...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])'),
  ];
  const at = radios.indexOf(document.activeElement as HTMLElement);
  if (!radios.length) return;
  e.preventDefault();
  const next =
    e.key === "Home"
      ? 0
      : e.key === "End"
        ? radios.length - 1
        : (at + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + radios.length) %
          radios.length;
  radios[next]!.focus();
}

/**
 * "How sure are you?" as a group of three choices, asked once there is an
 * answer and before it is shown. Choosing one is the action (submit or
 * reveal), so it costs a single tap; `value` marks a choice already made.
 */
export function SurenessPicker({
  onPick,
  disabled,
  hint,
  legend = "How sure are you?",
  value,
  className,
}: {
  onPick: (s: Sureness) => void;
  disabled?: boolean;
  /** One line under the legend, e.g. "Choose one to see the answer." */
  hint?: string;
  legend?: string;
  value?: Sureness | null;
  className?: string;
}) {
  const legendId = useId();
  const hintId = useId();
  return (
    <div className={cn("font-sans", className)}>
      <p id={legendId} className="text-ui text-ink">
        {legend}
      </p>
      {hint && (
        <p id={hintId} className="mt-0.5 text-sm text-ink-3">
          {hint}
        </p>
      )}
      <div
        role="radiogroup"
        aria-labelledby={legendId}
        aria-describedby={hint ? hintId : undefined}
        className="mt-2 flex flex-wrap gap-2"
        onKeyDown={radioArrows}
      >
        {LEVELS.map((s, i) => (
          <Button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            tabIndex={value ? (value === s ? 0 : -1) : i === 0 ? 0 : -1}
            variant={value === s ? "secondary" : "outline"}
            disabled={disabled}
            onClick={() => onPick(s)}
            className="disabled:border-dashed disabled:bg-transparent disabled:text-ink-3 disabled:shadow-none"
          >
            {SURENESS_LABELS[s]}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** "just a guess", "fairly sure", "sure": for feedback on a stored confidence. */
export function surenessPhrase(percent: number | null | undefined): string | null {
  if (percent === null || percent === undefined) return null;
  return SURENESS_LABELS[surenessOf(percent)].toLowerCase();
}
