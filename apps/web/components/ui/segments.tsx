"use client"

import { cn } from "@/lib/utils"

/**
 * A segmented choice (docs/visual.md §4): a few fixed options in a recessed
 * field, the chosen one raised to paper. For settings that are one of two or
 * three things (text size, how a page opens); a radio group to assistive tech.
 */
function Segments<T extends string>({
  options,
  value,
  onChange,
  sample = false,
  className,
  "aria-label": ariaLabel,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  /** Draw each label at the size it stands for (text size). */
  sample?: boolean
  className?: string
  "aria-label"?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-slot="segments"
      className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-field p-0.5 shadow-field", className)}
    >
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-8 rounded-sm px-2 font-sans text-ui leading-tight transition-colors",
              on ? "bg-paper font-medium text-ink ring-1 ring-rule" : "text-ink-2 hover:text-ink",
              sample && (i === 0 ? "text-[0.8125rem]" : i === options.length - 1 ? "text-[0.9375rem]" : "")
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export { Segments }
