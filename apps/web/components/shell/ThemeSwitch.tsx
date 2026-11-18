"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "system", label: "Match my device", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

/** Light, dark, or follow the device (default). */
export function ThemeSwitch() {
  const { theme = "system", resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const CurrentIcon = !mounted ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-rule-soft hover:text-ink aria-expanded:bg-rule-soft aria-expanded:text-ink"
        aria-label="Appearance"
      >
        <CurrentIcon className="size-[18px]" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 gap-0 p-1.5">
        <p className="px-2 pt-1.5 pb-1 font-sans text-xs font-medium text-ink-3">Appearance</p>
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left font-sans text-ui transition-colors hover:bg-rule-soft",
                active ? "font-medium text-ink" : "text-ink-2",
              )}
            >
              <Icon className="size-4 text-ink-3" aria-hidden />
              {label}
              {active && <Check className="ml-auto size-4 text-indigo" aria-hidden />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
