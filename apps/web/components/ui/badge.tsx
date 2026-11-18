import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * A tag: 4px radius, never a pill. Variants are meanings (docs/visual.md):
 * evidence (indigo), place (sandstone), contested (turmeric), refuted (madder),
 * person (sage), neutral. The shadcn names stay as aliases for existing callers.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-1.5 font-sans text-xs font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/85",
        evidence: "bg-indigo-wash text-indigo [a]:hover:bg-indigo-tint/50",
        place: "bg-sandstone-wash text-sandstone-ink [a]:hover:bg-sandstone/20",
        contested: "bg-turmeric-wash text-turmeric-ink [a]:hover:bg-turmeric/25",
        refuted: "bg-madder-wash text-madder [a]:hover:bg-madder/20",
        person: "bg-sage-wash text-sage [a]:hover:bg-sage/20",
        neutral: "bg-rule-soft text-ink-2 [a]:hover:bg-rule",
        secondary: "bg-indigo-wash text-indigo [a]:hover:bg-indigo-tint/50",
        destructive: "bg-madder-wash text-madder [a]:hover:bg-madder/20",
        outline: "border-rule text-ink-2 [a]:hover:bg-rule-soft [a]:hover:text-ink",
        ghost: "text-ink-2 hover:bg-rule-soft hover:text-ink",
        link: "text-indigo underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
