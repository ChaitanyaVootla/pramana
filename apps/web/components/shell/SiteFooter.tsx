import Link from "next/link";
import { Frame } from "./Frame";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "The library",
    links: [
      { href: "/", label: "Ages" },
      { href: "/timeline", label: "Timeline" },
      { href: "/places", label: "Places" },
      { href: "/people", label: "People" },
    ],
  },
  {
    title: "Your desk",
    links: [
      { href: "/learn", label: "Learn" },
      { href: "/canvas", label: "Canvas" },
      { href: "/notes", label: "Notes" },
      { href: "/insights", label: "Insights" },
    ],
  },
  {
    title: "The record",
    links: [
      { href: "/review", label: "Proposed changes" },
      { href: "/audit", label: "History of changes" },
      { href: "/connect", label: "Connect your AI" },
    ],
  },
];

/**
 * The foot of every page (docs/visual.md §4): the slab again, closing the page
 * the way the top bar opens it. The whole site map in three columns (the
 * library, the desk, the record), what the site holds in one sentence, and the
 * licences. Hidden on the canvas board, which is an app surface.
 */
export function SiteFooter({ claims, sources, pending }: { claims: number; sources: number; pending: number }) {
  return (
    <footer className="site-footer on-slab mt-14 font-sans sm:mt-20">
      <Frame className="grid gap-x-10 gap-y-8 pt-10 pb-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="min-w-0">
          <p className="font-display text-3xl leading-none text-ink">
            Pramāṇa{" "}
            <span lang="sa" className="text-ink-3">
              प्रमाण
            </span>
          </p>
          <p className="mt-3 max-w-[34ch] text-note text-ink-2">
            A means of valid knowledge. Indian history where every statement points to the words it rests on.
          </p>
          <p className="mt-4 text-sm text-ink-3">
            <span className="tnum">{claims.toLocaleString("en-GB")}</span> claims from{" "}
            <span className="tnum">{sources.toLocaleString("en-GB")}</span> sources
            {pending > 0 ? (
              <>
                ,{" "}
                <Link href="/review" className="text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink">
                  {pending} waiting for review
                </Link>
              </>
            ) : null}
            .
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title} className="min-w-0">
            <p className="text-sm text-ink-3">{c.title}</p>
            <ul className="mt-2 space-y-0.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex min-h-8 items-center text-note text-ink-2 no-underline transition-colors hover:text-ink hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Frame>
      <Frame className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-rule py-4 text-sm text-ink-3">
        <p>
          Code under AGPL-3.0, on{" "}
          <a
            href="https://github.com/ChaitanyaVootla/pramana"
            className="text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink"
          >
            GitHub
          </a>
          ; content under CC BY-SA 4.0. Quoted sources keep their own licences.
        </p>
        <p>
          Made by{" "}
          <a
            href="https://vootlachaitanya.com"
            rel="author"
            className="text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink"
          >
            Vootla Chaitanya
          </a>
        </p>
      </Frame>
    </footer>
  );
}
