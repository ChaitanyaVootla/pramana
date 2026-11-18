"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCanvasAction } from "@/app/canvas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "New canvas": a title, then straight to the empty board. */
export function NewCanvas() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  return (
    <Popover>
      <PopoverTrigger render={<Button />}>
        <Plus data-icon="inline-start" /> New canvas
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 font-sans">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createCanvasAction(title.trim() || "Untitled canvas");
              if (r.ok) router.push(`/canvas/${r.value.id}`);
              else toast.error(r.error);
            });
          }}
          className="space-y-2"
        >
          <label className="block text-sm text-ink-2" htmlFor="new-canvas-title">
            What is it about?
          </label>
          <Input
            id="new-canvas-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Aśoka and his edicts"
            maxLength={120}
            autoFocus
          />
          <Button type="submit" size="sm" disabled={pending}>
            Start the canvas
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
