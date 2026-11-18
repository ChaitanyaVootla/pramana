"use client";

import { useEffect, useState } from "react";

/** Whether a media query matches; `initial` is what the server renders (desktop first). */
export function useMediaQuery(query: string, initial = true) {
  const [matches, setMatches] = useState(initial);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}
