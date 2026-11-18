"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/** App-wide client providers: theme (system default), tooltips, toasts. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // The theme script runs from the server's HTML before paint. When React renders the tree again
      // in the browser (a not-found page, an error boundary) the script would be inert anyway, so it
      // is marked as data there, which keeps React from warning about a script in a component.
      scriptProps={typeof window === "undefined" ? undefined : { type: "application/json" }}
    >
      <TooltipProvider delay={250}>
        {children}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
