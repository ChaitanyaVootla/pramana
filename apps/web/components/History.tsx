import type { AuditEntry } from "@pramana/services";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { humanizeAction, RECORD_NOUNS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const WHEN = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const LINK =
  "text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo";

/** Audit entries as a table: what happened, who did it, for whom, and in which proposed change ("Made directly" when none). */
export function History({
  entries,
  showSubject = false,
  className,
}: {
  entries: AuditEntry[];
  showSubject?: boolean;
  className?: string;
}) {
  if (!entries.length)
    return <EmptyState size="sm" title="Nothing has been recorded yet." />;
  return (
    // On phones each entry is two lines, the heading row hidden: when and what happened; then who,
    // the item and the change. Cells sit side by side and wrap (the row is a flex box).
    <Table className={cn("font-sans text-ui tnum max-md:block [&>tbody]:max-md:block", className)}>
      <TableHeader className="max-md:hidden">
        <TableRow className="border-rule hover:bg-transparent">
          <TableHead className="h-8 pl-0 text-xs font-medium text-ink-3">When</TableHead>
          <TableHead className="h-8 text-xs font-medium text-ink-3">What happened</TableHead>
          <TableHead className="h-8 text-xs font-medium text-ink-3">Who</TableHead>
          {showSubject && <TableHead className="h-8 text-xs font-medium text-ink-3">Item</TableHead>}
          <TableHead className="h-8 pr-0 text-xs font-medium text-ink-3">Change</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e) => (
          <TableRow
            key={e.id}
            className="border-rule align-top hover:bg-rule-soft/40 max-md:flex max-md:flex-wrap max-md:items-baseline max-md:gap-x-3 max-md:py-2.5 [&>td]:max-md:block [&>td]:max-md:px-0 [&>td]:max-md:py-0.5"
          >
            <TableCell className="pl-0 align-top text-ink-3 max-md:w-32 max-md:shrink-0 max-md:text-sm">
              <time dateTime={e.at.toISOString()}>{WHEN.format(e.at)}</time>
            </TableCell>
            <TableCell className="min-w-[14rem] align-top whitespace-normal text-ink max-md:min-w-0 max-md:w-[calc(100%-8.75rem)]">
              {e.action === "changeset.applied" && e.data?.delegated === true
                ? `Approved by your AI for ${e.onBehalfOf?.displayName ?? "you"}, as asked`
                : humanizeAction(e.action)}
              {e.rationale && (
                <p className="mt-0.5 max-w-[48ch] text-sm text-ink-3">
                  {e.rationale.length > 200
                    ? `${e.rationale.slice(0, 197).trimEnd()}…`
                    : e.rationale}
                </p>
              )}
            </TableCell>
            <TableCell className="align-top whitespace-normal text-ink max-md:text-sm max-md:text-ink-2">
              {e.actor.displayName}
              {e.actor.kind !== "human" && (
                <span className="text-ink-3">
                  {" "}
                  ({e.actor.kind === "agent" ? "AI agent" : e.actor.kind})
                </span>
              )}
              {e.onBehalfOf && <span className="text-ink-2"> for {e.onBehalfOf.displayName}</span>}
              {e.sessionId && (
                <p className="text-sm text-ink-3 max-md:inline">
                  <span className="md:hidden">, </span>
                  <Link
                    href={`/audit?session=${encodeURIComponent(e.sessionId)}`}
                    className="underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-ink-3"
                  >
                    AI connection {e.sessionId.slice(-8)}
                  </Link>
                </p>
              )}
            </TableCell>
            {showSubject && <TableCell className="align-top max-md:text-sm">{subjectLink(e)}</TableCell>}
            <TableCell className="pr-0 align-top max-md:text-sm">
              {e.changesetId ? (
                <Link href={`/review/${e.changesetId}`} className={LINK}>
                  {e.changesetId.slice(-8)}
                </Link>
              ) : (
                <span className="text-ink-3">Made directly</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function subjectLink(e: AuditEntry) {
  if (!e.subjectId) return null;
  const short = e.subjectId.slice(-8);
  const href: Record<string, string> = {
    claim: `/c/${e.subjectId}`,
    source: `/s/${e.subjectId}`,
    entity: `/e/${e.subjectId}`,
    page: `/p/${e.subjectId}`,
    changeset: `/review/${e.subjectId}`,
  };
  const type = e.subjectType ?? "item";
  const noun = type === "changeset" ? "change" : (RECORD_NOUNS[type] ?? type.replace(/_/g, " "));
  const label = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${short}`;
  return href[type] ? (
    <Link href={href[type]} className={LINK}>
      {label}
    </Link>
  ) : (
    <span className="text-ink-2">{label}</span>
  );
}
