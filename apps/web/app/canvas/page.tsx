import { humanContext, listCanvases } from "@pramana/services";
import Link from "next/link";
import { NewCanvas } from "@/components/canvas/NewCanvas";
import { Frame } from "@/components/shell/Frame";
import { KIND_WORDS } from "@/components/canvas/types";

export const metadata = { title: "Your canvases" };
export const dynamic = "force-dynamic";

/** Words for what a canvas holds: "3 claims, a map and 2 pictures". */
function holds(kinds: Partial<Record<string, number>>): string {
  const plural: Record<string, [string, string]> = {
    claim: ["claim", "claims"],
    entity: ["person or place", "people and places"],
    chapter: ["part of a page", "parts of pages"],
    excerpt: ["quotation", "quotations"],
    media: ["picture", "pictures"],
    map: ["map", "maps"],
    timeline: ["timeline", "timelines"],
    note: ["study note", "study notes"],
    viz: ["chart", "charts"],
    text: ["text card", "text cards"],
  };
  const parts = Object.entries(kinds)
    .filter(([k, n]) => k !== "section" && n)
    .map(([k, n]) => `${n} ${(plural[k] ?? [KIND_WORDS[k] ?? k, KIND_WORDS[k] ?? k])[n === 1 ? 0 : 1]}`);
  if (parts.length <= 1) return parts.join("") || "Empty";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export default async function CanvasesPage() {
  const canvases = await listCanvases(await humanContext());
  return (
    <Frame className="pt-8 pb-16 sm:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[60ch]">
          <h1 className="text-4xl tracking-[-0.02em] text-ink">Your canvases</h1>
          <p className="mt-3 text-lg text-ink-2">
            Canvases of your own: put claims, people and places, parts of pages, quotations, pictures, maps and timelines
            side by side, with your own notes. What you add stays up to date with the site, and only you can see your
            canvases.
          </p>
        </div>
        <NewCanvas />
      </header>
      {canvases.length === 0 ? (
        <p className="mt-10 max-w-[60ch] font-sans text-note text-ink-2">
          No canvases yet. Start one here, or use “Add to a canvas” on any claim, place, picture or part as you read.
        </p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {canvases.map((c) => (
            <li key={c.id}>
              <Link href={`/canvas/${c.id}`} className="tile block h-full p-4 no-underline">
                <span className="block font-serif text-xl leading-tight text-ink">{c.title}</span>
                {c.description && <span className="mt-1 line-clamp-2 block font-sans text-note text-ink-2">{c.description}</span>}
                <span className="mt-3 block font-sans text-sm text-ink-3">{holds(c.kinds)}</span>
                <span className="mt-0.5 block font-sans text-sm text-ink-3 tnum">
                  Changed{" "}
                  {c.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}
