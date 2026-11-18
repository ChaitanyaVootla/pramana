import type { MetadataRoute } from "next";

/**
 * Web app manifest: installable as an app (PWA). Offline support (a service
 * worker caching the app shell and recently read pages) comes later.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pramāṇa: Indian history, with the evidence attached",
    short_name: "Pramāṇa",
    description: "Learn Indian history from claims that point to the exact words they rest on.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f2f4fa",
    theme_color: "#151b66",
    categories: ["education", "books", "reference"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
