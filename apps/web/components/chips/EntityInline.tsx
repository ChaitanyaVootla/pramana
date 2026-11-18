"use client";

import type { EntityCard } from "@pramana/services";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { usePointAt } from "@/components/atlas/bus";
import { EntityThumb } from "@/components/media";
import { datedLabel } from "@/lib/era";
import { cn } from "@/lib/utils";
import { GlossaryTerm } from "./Chips";
import { MiniStrip } from "./MiniStrip";
import { isLocated, useReader } from "./reader";
const CERTAINTY: Record<string, string> = {
  exact: "Location known.",
  approximate: "Location approximate.",
  conjectural: "Location is a scholarly guess.",
};

/**
 * An entity named in running prose: underlined like a link, with a preview on
 * hover or focus (who or what, when, where), and a glossary tooltip for terms.
 * Pointing at it lights it on the atlas. Inside a page reader, a place opens
 * its card beside the reading; otherwise tapping navigates, so nothing
 * depends on hover.
 */
export function EntityInline({
  entity,
  within,
  children,
}: {
  entity: EntityCard;
  within?: [number, number] | null;
  children: React.ReactNode;
}) {
  const reader = useReader();
  const point = usePointAt(entity.kind === "term" ? undefined : [entity.id]);
  if (entity.kind === "term") return <GlossaryTerm entity={entity}>{children}</GlossaryTerm>;
  const isPlace = isLocated(entity);
  const opens = isPlace && reader.selectEntity;
  const on = opens && reader.selectedEntity === entity.id;
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={250}
        render={<Link href={`/e/${entity.slug}`} />}
        {...point}
        onClick={
          opens
            ? (e: React.MouseEvent) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                reader.selectEntity!(entity.id);
              }
            : undefined
        }
        aria-current={on ? "true" : undefined}
        className={cn(
          "rounded-[2px] text-ink underline decoration-[1.5px] underline-offset-3 transition-[text-decoration-color,background-color]",
          isPlace
            ? "decoration-sandstone/45 hover:decoration-sandstone"
            : "decoration-indigo-tint hover:decoration-indigo",
          on && "bg-sandstone-wash decoration-sandstone shadow-[0_0_0_2px_var(--sandstone-wash)]",
        )}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-72 font-sans text-note">
        <div className="flex items-start gap-3">
          {entity.image && <EntityThumb image={entity.image} size={40} decorative />}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-serif text-lg leading-tight text-ink">
              {isPlace && <MapPin className="size-4 text-sandstone" aria-hidden />}
              {entity.label}
            </p>
            {entity.whenLabel && (
              <p className="mt-0.5 text-sm text-ink-2 tnum">{datedLabel(entity)}</p>
            )}
          </div>
        </div>
        {entity.description && <p className="mt-2 leading-snug text-ink-2">{entity.description}</p>}
        {isPlace && entity.geo && (
          <p className="mt-1.5 text-sm text-ink-3">{CERTAINTY[entity.geo.certainty]}</p>
        )}
        {within && entity.bounds && !isPlace && (
          <div className="mt-2.5">
            <MiniStrip within={within} bounds={entity.bounds} width={240} />
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
