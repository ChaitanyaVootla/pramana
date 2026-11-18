"use client";

import type { CanvasItemContentInput } from "@pramana/core";
import { Check, LayoutDashboard, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addToCanvasAction, canvasChoicesAction, type CanvasChoice } from "@/app/canvas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** The thing's main reference, to mark the canvases that already hold it. */
function holdingOf(c: CanvasItemContentInput): { kind: CanvasItemContentInput["kind"]; id: string; chapterId?: string } | null {
  switch (c.kind) {
    case "claim":
      return { kind: c.kind, id: c.claimId };
    case "entity":
      return { kind: c.kind, id: c.entity };
    case "excerpt":
      return { kind: c.kind, id: c.excerptId };
    case "media":
      return { kind: c.kind, id: c.mediaId };
    case "note":
      return { kind: c.kind, id: c.noteId };
    case "chapter":
      return { kind: c.kind, id: c.page, chapterId: c.chapterId };
    default:
      return null;
  }
}

/**
 * "Add to canvas", wherever a thing appears: pick one of your canvases (those
 * that already hold it are marked), or start a new one with it. `icon` is the
 * compact form for rows and cards; the label stays for screen readers.
 */
export function AddToCanvas({
  content,
  what = "this",
  icon = false,
  size = "sm",
  className,
}: {
  content: CanvasItemContentInput;
  /** Short name of the thing, for the accessible label ("Add Kalinga to a canvas"). */
  what?: string;
  /** `true`: the icon alone; `"narrow"`: the icon alone below 768px and the label from there (by CSS, no flash). */
  icon?: boolean | "narrow";
  size?: "sm" | "xs";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<CanvasChoice[] | null>(null);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const holding = holdingOf(content);

  const load = () =>
    start(async () => {
      const r = await canvasChoicesAction(holding);
      if (r.ok) setChoices(r.value);
      else toast.error(r.error);
    });

  const add = (target: { canvasId: string } | { newTitle: string }) =>
    start(async () => {
      const r = await addToCanvasAction(target, content);
      if (!r.ok) return void toast.error(r.error);
      setOpen(false);
      setTitle("");
      setChoices(null);
      toast.success(`Added to ${r.value.title}.`, {
        action: { label: "Open", onClick: () => router.push(`/canvas/${r.value.canvasId}`) },
      });
    });

  const held = choices?.filter((c) => c.holds).length ?? 0;
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) load();
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size={icon === true ? (size === "xs" ? "icon-xs" : "icon-sm") : size}
            className={cn(
              icon === true ? "text-ink-3 hover:text-ink" : "text-ink-2",
              icon === "narrow" && "max-md:px-1.5 max-md:text-ink-3",
              className,
            )}
            aria-label={`Add ${what} to a canvas`}
            title={icon ? "Add to a canvas" : undefined}
          />
        }
      >
        <LayoutDashboard data-icon="inline-start" aria-hidden />
        {icon !== true && <span className={cn(icon === "narrow" && "hidden md:inline")}>Add to a canvas</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1 font-sans text-ui">
        <p className="px-2 pt-1.5 pb-1 text-sm text-ink-3">
          {held > 0 ? `Already on ${held} of your canvases` : "Add to a canvas"}
        </p>
        {choices === null ? (
          <p className="px-2 py-2 text-sm text-ink-3">Loading your canvases</p>
        ) : (
          <ul className="scroll-thin max-h-60 overflow-y-auto">
            {choices.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => add({ canvasId: c.id })}
                  className="flex min-h-9 w-full items-center gap-2 rounded-sm px-2 text-left hover:bg-rule-soft disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1 truncate text-ink">{c.title}</span>
                  {c.holds ? (
                    <span className="flex items-center gap-1 text-xs text-ink-3">
                      <Check className="size-3.5" aria-hidden /> on it
                    </span>
                  ) : (
                    <span className="text-xs text-ink-3 tnum">{c.itemCount}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-1 flex gap-1 border-t border-rule-soft p-1 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            add({ newTitle: title.trim() || "Untitled canvas" });
          }}
        >
          <label className="sr-only" htmlFor={`new-canvas-${holding?.id ?? "x"}`}>
            New canvas title
          </label>
          <Input
            id={`new-canvas-${holding?.id ?? "x"}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New canvas"
            maxLength={120}
            className="h-8"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            <Plus data-icon="inline-start" /> Start
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
