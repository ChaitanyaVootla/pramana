import {
  isUuid,
  NOTE_SUBJECT_TYPES,
  NoteSubjectType,
  type NoteSubjectType as SubjectType,
} from "@pramana/core";
import { getDb } from "@pramana/db";
import {
  humanContext,
  listNotes,
  noteCounts,
  noteSubjectId,
  ownerOf,
  type NoteFilter,
} from "@pramana/services";
import Link from "next/link";
import { z } from "zod";
import { SUBJECT_FILTERS } from "@/components/ai/labels";
import { Lede, PageContainer, PageTitle } from "@/components/pages/Shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { NotesHistory } from "./NotesHistory";
import { SignInPrompt } from "@/components/shell/Account";
import { currentAccount } from "@/lib/auth";

export const metadata = { title: "Notes from your AI" };
export const dynamic = "force-dynamic";

const PAGE = 30;

const Query = z.object({
  about: NoteSubjectType.optional().catch(undefined),
  /** An id, or a page or entity slug. */
  id: z.string().min(1).max(200).optional().catch(undefined),
  show: z.enum(["shown", "pinned", "archived", "all"]).optional().catch(undefined),
  before: z.uuid().optional().catch(undefined),
});

const SHOW: Record<"shown" | "pinned" | "archived" | "all", string> = {
  shown: "On the pages",
  pinned: "Pinned",
  archived: "Archived",
  all: "All, with archived",
};

/**
 * Every note the reader's AI has posted, newest first: filter by what they are
 * about, pin the ones to keep, archive the rest. A plain list (docs/visual.md §7).
 */
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if ((await currentAccount()).mode === "guest") return <SignInPrompt title="Your notes" />;
  const q = Query.parse(await searchParams);
  const show = q.show ?? "shown";
  const human = await humanContext();
  const filter: NoteFilter = {
    status: show,
    before: q.before,
    limit: PAGE + 1,
  };
  let id = q.about === "general" ? null : (q.id ?? null);
  if (id && !isUuid(id))
    id =
      q.about === "page" || q.about === "entity"
        ? await noteSubjectId(
            getDb(),
            q.about === "page" ? { type: "page", page: id } : { type: "entity", entity: id },
            ownerOf(human),
          ).catch(() => null)
        : null;
  if (q.about) filter.subject = { type: q.about, id };
  const [rows, counts] = await Promise.all([
    listNotes(human, filter),
    noteCounts(human),
  ]);
  const notes = rows.slice(0, PAGE);
  const older = rows.length > PAGE ? notes[notes.length - 1]!.id : null;

  const byType = new Map<SubjectType, number>();
  let total = 0;
  for (const c of counts) {
    const visible =
      show === "all" || (show === "shown" ? c.status !== "archived" : c.status === show);
    if (!visible) continue;
    byType.set(c.type, (byType.get(c.type) ?? 0) + c.count);
    total += c.count;
  }
  const href = (p: { about?: string; show?: string }) => {
    const params = new URLSearchParams();
    const about = "about" in p ? p.about : q.about;
    const s = p.show ?? show;
    if (about) params.set("about", about);
    if (about && about === q.about && q.id) params.set("id", q.id);
    if (s !== "shown") params.set("show", s);
    const str = params.toString();
    return str ? `/notes?${str}` : "/notes";
  };
  const one = q.about && q.id ? notes[0]?.subject : null;

  return (
    <PageContainer>
      <div className="max-w-[48rem]">
        <PageTitle>Notes from your AI</PageTitle>
        <Lede>
          Answers, comparisons and charts your AI has put beside what you read. They are your
          AI&rsquo;s words, not checked by Pramāṇa. Pin the ones you want to keep at the top.
          Archive the rest: they leave the pages but stay in this list.
        </Lede>
        {one && (
          <p className="mt-4 font-sans text-ui text-ink-2">
            About{" "}
            {one.href ? (
              <Link
                href={one.href}
                className="text-ink underline decoration-rule underline-offset-2 hover:decoration-ink-3"
              >
                {one.label}
              </Link>
            ) : (
              one.label
            )}
            .{" "}
            <Link
              href={href({ about: undefined })}
              className="text-ink-3 underline decoration-rule underline-offset-2 hover:text-ink"
            >
              Show notes about everything
            </Link>
          </p>
        )}
        <nav aria-label="Filter notes" className="mt-6 space-y-2 font-sans text-ui">
          <ul className="flex flex-wrap items-center gap-x-1 gap-y-1" aria-label="About">
            <li className="w-14 text-sm text-ink-3" aria-hidden>
              About
            </li>
            <FilterLink href={href({ about: undefined })} active={!q.about} count={total}>
              All topics
            </FilterLink>
            {NOTE_SUBJECT_TYPES.filter((t) => byType.get(t) || q.about === t).map((t) => (
              <FilterLink
                key={t}
                href={href({ about: t })}
                active={q.about === t}
                count={byType.get(t) ?? 0}
              >
                {SUBJECT_FILTERS[t]}
              </FilterLink>
            ))}
          </ul>
          <ul className="flex flex-wrap items-center gap-x-1 gap-y-1" aria-label="Show">
            <li className="w-14 text-sm text-ink-3" aria-hidden>
              Show
            </li>
            {(Object.keys(SHOW) as (keyof typeof SHOW)[]).map((s) => (
              <FilterLink key={s} href={href({ show: s })} active={show === s}>
                {SHOW[s]}
              </FilterLink>
            ))}
          </ul>
        </nav>
        <NotesHistory className="mt-8" notes={notes} />
        {notes.length === 0 &&
          (total === 0 && show === "shown" && !q.about ? (
            <EmptyState
              className="mt-8"
              title="No notes yet"
              action={
                <Link
                  href="/connect"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Connect your AI
                </Link>
              }
            >
              Connect your AI, then ask it about something you are reading: its answer appears next
              to what you were reading, and in this list.
            </EmptyState>
          ) : (
            <EmptyState
              className="mt-8"
              size="sm"
              title="No notes match"
              action={
                <Link href="/notes" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Show all notes
                </Link>
              }
            />
          ))}
        {older && (
          <p className="mt-8 font-sans text-ui">
            <Link
              href={`${href({})}${href({}).includes("?") ? "&" : "?"}before=${older}`}
              className="text-indigo hover:underline"
            >
              Older notes
            </Link>
          </p>
        )}
      </div>
    </PageContainer>
  );
}

function FilterLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 no-underline transition-colors hover:bg-rule-soft hover:text-ink",
          active ? "bg-rule-soft font-medium text-ink" : "text-ink-2",
        )}
      >
        {children}
        {count !== undefined && <span className="text-sm text-ink-3 tnum">{count}</span>}
      </Link>
    </li>
  );
}
