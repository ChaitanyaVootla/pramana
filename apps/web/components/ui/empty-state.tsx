import { cn } from "@/lib/utils"

/**
 * A designed empty state (docs/visual.md §4): never a blank. One sentence in
 * sans saying what would be here, and the one action that fills it, in the
 * space the content would take. Drawn as a recessed field: the gap is shown,
 * as the seal shows a missing source, not hidden.
 *
 *   <EmptyState title="No borders are known for this year" action={<Button …>Ask your AI</Button>}>
 *     The datasets we draw from stop at 1950; nothing is drawn rather than something guessed.
 *   </EmptyState>
 */
function EmptyState({
  title,
  children,
  action,
  size = "default",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  /** What would be here, as a short sentence. */
  title: React.ReactNode
  /** Why it is empty or what fills it (optional second sentence). */
  children?: React.ReactNode
  /** The one action that fills it: a Button or a Link styled as one. */
  action?: React.ReactNode
  /** `sm` for a rail block or a list; `default` for a page region. */
  size?: "sm" | "default"
}) {
  return (
    <div
      data-slot="empty-state"
      role="status"
      className={cn(
        "field flex flex-col items-center justify-center text-center font-sans",
        size === "sm" ? "min-h-20 gap-1.5 px-4 py-4" : "min-h-40 gap-2 px-6 py-8",
        className
      )}
      {...props}
    >
      <p className={cn("max-w-[44ch] text-ink", size === "sm" ? "text-ui" : "text-note")}>{title}</p>
      {children && (
        <p className={cn("max-w-[52ch] text-ink-2", size === "sm" ? "text-sm" : "text-ui")}>{children}</p>
      )}
      {action && <div className="mt-1.5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
