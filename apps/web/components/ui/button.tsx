import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding font-sans text-ui font-medium whitespace-nowrap outline-none select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out-quart)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),var(--indigo-deep)_35%)] dark:hover:bg-[color-mix(in_oklch,var(--primary),white_10%)]",
        outline:
          "border-rule bg-paper text-ink hover:border-ink-3/60 hover:bg-rule-soft/60 aria-expanded:bg-rule-soft aria-expanded:text-ink",
        secondary:
          "bg-indigo-wash text-indigo hover:bg-[color-mix(in_oklch,var(--indigo-wash),var(--indigo)_10%)] aria-expanded:bg-indigo-wash",
        ghost:
          "text-ink-2 hover:bg-rule-soft hover:text-ink aria-expanded:bg-rule-soft aria-expanded:text-ink",
        destructive:
          "bg-madder-wash text-madder hover:bg-[color-mix(in_oklch,var(--madder-wash),var(--madder)_12%)] focus-visible:ring-destructive/50",
        link: "h-auto px-0 text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo",
      },
      size: {
        default:
          "h-9 gap-2 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-sm px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-2.5 text-[0.8125rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-note has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs":
          "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
