"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

const COLORS = { light: "#f3f2ee", dark: "#0f1015" };

/**
 * Keeps the browser chrome (address bar, PWA title bar) the colour of the page
 * ground when the person picks a theme that differs from the device's.
 */
export function ThemeColor() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const color = resolvedTheme === "dark" ? COLORS.dark : COLORS.light;
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      const m = document.createElement("meta");
      m.name = "theme-color";
      document.head.appendChild(m);
      m.content = color;
      return;
    }
    metas.forEach((m) => {
      m.removeAttribute("media");
      m.content = color;
    });
  }, [resolvedTheme]);
  return null;
}
