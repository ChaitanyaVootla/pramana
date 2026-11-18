"use client";

import { Plus } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { addToDeckAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

/** "Add to my reviews" for one or more claims; the toast repeats the verb. */
export function AddToDeckButton({
  claimIds,
  label = "Add to my reviews",
  variant = "outline",
  className,
}: {
  claimIds: string[];
  label?: string;
  variant?: "outline" | "ghost" | "default";
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      className={className}
      disabled={pending || claimIds.length === 0}
      onClick={() =>
        start(async () => {
          const r = await addToDeckAction(claimIds);
          if (r.ok) toast.success(r.message ?? "Added to your reviews.");
          else toast.error(r.error);
        })
      }
    >
      <Plus /> {label}
    </Button>
  );
}
