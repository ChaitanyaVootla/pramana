"use client";

import {
  claimIdsInBlock,
  dateBounds,
  formatYear,
  markdownInBlock,
  type Block,
} from "@pramana/core";
import type {
  ClaimCard,
  EntityCard,
  MapFeature,
  NoteView,
  PageView,
  TimelineItem,
} from "@pramana/services";
import {
  ArrowDown,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  List,
  Map as MapIcon,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addPageToDeckAction, archiveNoteAction, markVisitedAction } from "@/app/actions";
import { Atlas } from "@/components/atlas/Atlas";
import { AtlasProvider, useAtlasBus, usePointAt } from "@/components/atlas/bus";
import { DateChip, EntityChip } from "@/components/chips/Chips";
import { Badge } from "@/components/ui/badge";
import { claimElement, ReaderContext, type Reader } from "@/components/chips/reader";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { SealLadder } from "@/components/evidence/ChainOverview";
import { EvidenceSeal } from "@/components/evidence/EvidenceSeal";
import { Markdown } from "@/components/Markdown";
import { ERA_GRID, Frame } from "@/components/shell/Frame";
import { PeriodTimeline } from "@/components/time/PeriodTimeline";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  chapterBounds,
  chapterBrief,
  chapterContext,
  chapterPhaseLabel,
  chapterTitle,
  chapterWhenLabel,
  claimsNaming,
  answerWords,
  guessDistance,
  guessWords,
  layoutEra,
  blockSeconds,
  readingMinutes,
  wordCount,
  resolveEraSpec,
  datedLabel,
  durationWords,
  stripMark,
  yearOf,
  yearsAgo,
  type Chapter,
  type EraLayout,
} from "@/lib/era";
import { useLiveEvents } from "@/lib/useLiveEvents";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { ChapterProgressSeal } from "@/components/learn/ChapterProgressSeal";
import { CheckView } from "@/components/learn/Check";
import { guessPlacements, type GuessBlock } from "@/components/learn/placement";
import { MediaTile, type ViewerMedia } from "@/components/media";
import { Disclosure } from "@/components/pages/Disclosure";
import { BlockView } from "./Blocks";
import { ClaimItem } from "./ClaimItem";
import { AgesIndex } from "./AgesIndex";
import { LeadImage } from "./LeadImage";
import { PartBody, PartBrief } from "./Part";
import { PartMapThumb } from "./PartMapThumb";
import { usePageLearning } from "@/components/learn/store";
import { AskAi } from "@/components/ai/AskAi";
import { InThisPart, NotesPanel, Panel, PlaceCard } from "./ContextRail";
import { AddToCanvas } from "@/components/canvas/AddToCanvas";
import {
  AiChangeNotice,
  CustomiseButton,
  YourNoteButton,
  YourPartExtras,
} from "@/components/yourview/Customise";
import { usePageViewFor, useYourView } from "@/components/yourview/YourView";
import { ERA_VIEW_PANELS, type AtlasStop } from "@pramana/core";
import { jumpTo, Outline, scrollWhenSettled, type OutlineItem } from "./Outline";

/**
 * The floating chapter pill is for finding your place while reading: it appears once the
 * first chapter is reached, hides while the reader scrolls on down, and comes back when
 * they scroll up (looking for something) or reach the end.
 */
function usePillVisibility(
  sections: React.RefObject<Map<string, HTMLElement>>,
  firstId: string | null,
) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const first = firstId ? sections.current.get(firstId) : null;
      const reading = first ? first.getBoundingClientRect().top < window.innerHeight * 0.5 : false;
      const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 40;
      if (Math.abs(y - last) > 6 || atEnd) {
        setShown(reading && (y < last || atEnd));
        last = y;
      }
    };
    const on = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", on);
    };
  }, [sections, firstId]);
  return shown;
}

/** Map height for the rail atlas: about a third of the viewport, so the context card keeps room below it. */
function useRailMapHeight() {
  const [h, setH] = useState(260);
  useEffect(() => {
    const on = () => setH(Math.round(Math.min(400, Math.max(180, window.innerHeight * 0.32))));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return h;
}

const PLACE_KINDS = ["place", "site", "inscription", "event"];

/** A picture attached to a part (a figure, or one of its places' pictures). */
interface PartPicture {
  key: string;
  media: ViewerMedia;
  caption?: string;
}

export interface EraPageProps {
  view: PageView;
  notes: NoteView[];
  /** The notes version `notes` were read at (see /api/events "hello"). */
  notesVersion?: string;
  /** Number of the era among all ages, for the breadcrumb ("age 5 of 15"). */
  ages?: { index: number; total: number } | null;
  /** Everything dated, for the period timeline (all ages plus what is linked to this era). */
  timeline?: TimelineItem[];
  pageByEntity?: Record<string, string>;
  /** Year the atlas opens on (the spec's, or when the page's polity was largest). */
  initialYear?: number | null;
  /** The lead image (spec.hero.media), rendered by the caller; nothing is drawn when absent. */
  media?: React.ReactNode;
  /** The age line (components/time/AgeLine, rendered by the route): where this era sits in all of Indian history. */
  ageLine?: React.ReactNode;
}

/**
 * An era page: orient, then read. The hero and the chapters share one grid
 * with a sticky rail holding the atlas (map and period timeline) and a
 * context card. Reading only moves quiet things (the outline marker, the
 * places emphasised on the map); the map moves when the reader points at or
 * picks something.
 */
export function EraPage(props: EraPageProps) {
  // The learner's own view (if any) laid over the page's spec; the page itself is unchanged.
  const viewed = usePageViewFor(props.view);
  const ownYear = useYourView()?.view.atlas.initialYear;
  const layout = useMemo(
    () => layoutEra(viewed.page.blocks, claimIdsInBlock),
    [viewed.page.blocks],
  );
  const spec = useMemo(
    () => resolveEraSpec(viewed, layout.chapters.length),
    [viewed, layout.chapters.length],
  );
  const body = (
    <EraReader
      {...props}
      view={viewed}
      layout={layout}
      spec={spec}
      publishedStops={props.view.page.spec.atlas?.stops ?? []}
    />
  );
  if (!spec.atlas) return body;
  return (
    <AtlasProvider initialYear={ownYear ?? props.initialYear ?? spec.atlas.initialYear ?? null}>
      {body}
    </AtlasProvider>
  );
}

function EraReader({
  view,
  notes: initialNotes,
  notesVersion,
  ages,
  timeline = [],
  pageByEntity,
  media,
  ageLine,
  initialYear,
  layout,
  spec,
  publishedStops,
}: EraPageProps & {
  layout: EraLayout;
  spec: ReturnType<typeof resolveEraSpec>;
  /** The page's own turning points (before the learner's view hides any), for "Customise". */
  publishedStops: AtlasStop[];
}) {
  const { page } = view;
  const entity = page.entity;
  const within: [number, number] | null =
    entity?.bounds?.startMin != null && entity.bounds.endMax != null
      ? [entity.bounds.startMin, entity.bounds.endMax]
      : null;

  const bus = useAtlasBus();
  const [selected, setSelected] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(layout.chapters[0]?.id ?? null);
  const [notes, setNotes] = useState(initialNotes);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [outlineOpen, setOutlineOpen] = useState(false);
  // Phones: the map is open under the orientation (docs/visual.md §3), and folds on request.
  const [mapOpen, setMapOpen] = useState(true);
  const [pending, start] = useTransition();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const wide = useMediaQuery("(min-width: 1280px)");
  const mapHeight = useRailMapHeight();
  const atlasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void markVisitedAction(page.id);
  }, [page.id]);

  // Where the reader is: the part crossing a line a third of the way down the viewport. An
  // observer, so it follows the page's own changes too (parts opening, pictures loading), not only
  // scrolling. Between two parts (the line in the gap) the last one stays.
  const sections = useRef<Map<string, HTMLElement>>(new Map());
  const pillShown = usePillVisibility(sections, layout.chapters[0]?.id ?? null);
  useEffect(() => {
    const crossing = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) crossing.add(e.target.id);
          else crossing.delete(e.target.id);
        const hit = layout.chapters.find((c) => crossing.has(c.id));
        if (hit) setActive(hit.id);
      },
      { rootMargin: "-35% 0px -64% 0px" },
    );
    for (const c of layout.chapters) {
      const el = sections.current.get(c.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [layout.chapters]);

  // Live notes from a study session (an agent posting over MCP).
  const notesAt = useRef(notesVersion);
  const refreshNotes = useCallback(async () => {
    const res = await fetch(`/api/notes?page=${page.id}`, { cache: "no-store" });
    if (!res.ok) return;
    notesAt.current = res.headers.get("X-Notes-Version") ?? undefined;
    const next = (await res.json()) as NoteView[];
    setNotes((prev) => {
      const known = new Set(prev.map((n) => n.id));
      const added = next.filter((n) => !known.has(n.id));
      // Notes arrive quietly where they belong (docs/visual.md §7): no toast.
      if (added.length) setFresh(new Set(added.map((n) => n.id)));
      return next;
    });
  }, [page.id]);
  useLiveEvents((event) => {
    // "hello" comes on every (re)connect: catch up on notes posted while the stream was down, if any were.
    if (event.table === "notes") void refreshNotes();
    if (event.table === "hello" && (!event.notesVersion || event.notesVersion !== notesAt.current))
      void refreshNotes();
  });
  const dismissNote = useCallback((id: string) => {
    void archiveNoteAction(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const chapterOf = useMemo(() => {
    const m = new Map<string, Chapter>();
    for (const c of layout.chapters) for (const id of c.claimIds) if (!m.has(id)) m.set(id, c);
    return m;
  }, [layout.chapters]);
  // Parts with a one-minute version open folded; the reader opens them, one by one or all at
  // once, and the page remembers which.
  const briefed = useMemo(
    () => layout.chapters.filter((c) => chapterBrief(c)).map((c) => c.id),
    [layout.chapters],
  );
  const partsKey = `pramana:parts:${page.id}`;
  const [openParts, setOpenParts] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(partsKey) ?? "[]") as string[];
      if (saved.length) setOpenParts((cur) => new Set([...cur, ...saved]));
    } catch {
      /* nothing remembered */
    }
  }, [partsKey]);
  const saveParts = useCallback(
    (next: Set<string>) => {
      try {
        localStorage.setItem(partsKey, JSON.stringify([...next]));
      } catch {
        /* private mode */
      }
      return next;
    },
    [partsKey],
  );
  const openPart = useCallback(
    (id: string) => setOpenParts((cur) => (cur.has(id) ? cur : saveParts(new Set([...cur, id])))),
    [saveParts],
  );
  const togglePart = useCallback(
    (id: string) =>
      setOpenParts((cur) => {
        const next = new Set(cur);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return saveParts(next);
      }),
    [saveParts],
  );
  // Reading time per part and for the short versions (see blockSeconds): fixed by the content, so
  // the same page always gives the same estimate.
  const blockWords = useCallback(
    (b: Block): number => {
      if (b.type === "prose" || b.type === "callout") return wordCount(b.markdown);
      if (b.type === "quote") return wordCount(view.excerpts[b.excerptId]?.quote ?? "");
      if (
        b.type === "claims" ||
        b.type === "key_facts" ||
        b.type === "debate" ||
        b.type === "misconception"
      )
        return claimIdsInBlock(b).reduce((n, id) => n + wordCount(view.claims[id]?.text ?? ""), 0);
      if (b.type === "guess") return wordCount(b.question);
      return markdownInBlock(b).reduce((n, m) => n + wordCount(m), 0);
    },
    [view.excerpts, view.claims],
  );
  const partSeconds = useMemo(
    () =>
      new Map(
        layout.chapters.map((c) => [
          c.id,
          c.blocks.reduce((n, b) => n + blockSeconds(b, blockWords), 0),
        ]),
      ),
    [layout.chapters, blockWords],
  );
  // Skimming: each short version, plus its "Guess first" (most parts open with one).
  const skimSeconds = useMemo(
    () =>
      layout.chapters.reduce((n, c) => {
        const br = chapterBrief(c);
        if (!br) return n;
        const guess = c.blocks.find((b) => b.type === "guess");
        return (
          n +
          (wordCount(br.happened) + wordCount(br.howWeKnow)) * 0.3 +
          (guess ? blockSeconds(guess, blockWords) : 0)
        );
      }, 0),
    [layout.chapters, blockWords],
  );
  const fullMinutes = readingMinutes([...partSeconds.values()].reduce((a, b) => a + b, 0));
  const skimMinutes = readingMinutes(skimSeconds);
  // What the learner has answered (shared with the question blocks); the summary of a part waits
  // for its "Guess first" until the reader guesses, skips, or asks for it.
  const { state: learning } = usePageLearning(page.id);
  // Your view: how the page opens (short versions or in full), and parts already read kept folded.
  const yv = useYourView();
  const ownReading = yv?.view.reading;
  const foldKnown = yv?.view.foldKnown ?? false;
  const viewRevision = yv?.revision ?? 0;
  const showMeanwhile = Boolean(layout.meanwhile) && !yv?.hides("meanwhile");
  // On top of the remembered parts: the view's reading mode applies once each time it changes (by the
  // reader, or by their AI while the page was closed); parts opened or folded after that are remembered.
  useEffect(() => {
    if (!ownReading) return;
    const modeKey = `pramana:parts-mode:${page.id}`;
    try {
      if (localStorage.getItem(modeKey) === `${ownReading}:${viewRevision}`) return;
      localStorage.setItem(modeKey, `${ownReading}:${viewRevision}`);
    } catch {
      /* private mode: apply every time */
    }
    setOpenParts(saveParts(new Set(ownReading === "full" ? briefed : [])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownReading, viewRevision]);
  useEffect(() => {
    if (!foldKnown || learning.status !== "ready") return;
    const known = new Set(briefed.filter((id) => learning.data.chapters[id]?.read));
    if (known.size)
      setOpenParts((cur) => saveParts(new Set([...cur].filter((id) => !known.has(id)))));
  }, [foldKnown, learning, briefed, saveParts]);
  const [announcement, setAnnouncement] = useState("");
  // "Next": the map moves to the next part's year (the reader asked), focus goes to its heading,
  // and a live region says where they are.
  const goToPart = useCallback(
    (part: Chapter, index: number, year: number | null) => {
      if (spec.atlas && year !== null) bus.setYear(year, { fromReader: true });
      jumpTo(part.id);
      requestAnimationFrame(() =>
        document.getElementById(`${part.id}-title`)?.focus({ preventScroll: true }),
      );
      setAnnouncement(
        `Part ${index + 1}: ${chapterTitle(part)}.${spec.atlas && year !== null ? ` The map shows ${formatYear(year)}.` : ""}`,
      );
    },
    [spec.atlas, bus],
  );
  const isOpen = useCallback((c: Chapter) => !chapterBrief(c) || openParts.has(c.id), [openParts]);
  // Opens the folded part that holds an element (a claim, a block) so scrolling can reach it.
  const reveal = useCallback(
    (el: Element | null) => {
      const part = el?.closest(".part-body")?.closest("section[id]");
      if (part) openPart(part.id);
    },
    [openPart],
  );
  useEffect(() => {
    const on = (e: Event) => reveal(document.getElementById((e as CustomEvent<string>).detail));
    window.addEventListener("pramana:reveal", on);
    return () => window.removeEventListener("pramana:reveal", on);
  }, [reveal]);

  const claimOrder = useMemo(
    () => [...new Set(layout.chapters.flatMap((c) => c.claimIds))],
    [layout.chapters],
  );
  // Claims each chapter's prose (and captions) already links: lists after the prose skip them.
  const inProse = useMemo(
    () =>
      new Map(
        layout.chapters.map((c) => [
          c.id,
          new Set(
            c.blocks
              .filter((b) => ["prose", "callout", "figure", "gallery"].includes(b.type))
              .flatMap((b) => claimIdsInBlock(b)),
          ),
        ]),
      ),
    [layout.chapters],
  );
  const contexts = useMemo(
    () => new Map(layout.chapters.map((c) => [c.id, chapterContext(view, c)])),
    [layout.chapters, view],
  );
  // Each part's pictures, only those already attached to the page: its own figures and galleries,
  // then pictures of its places. The lead image is not repeated, and a place's picture that already
  // led an earlier part does not lead another.
  const partPictures = useMemo(() => {
    const lead = spec.media ? view.media[spec.media]?.id : undefined;
    const leading = new Set<string>(lead ? [lead] : []);
    return new Map(
      layout.chapters.map((c) => {
        const own: PartPicture[] = c.blocks.flatMap((b): PartPicture[] => {
          if (b.type === "figure") {
            const m = view.media[b.media];
            return m ? [{ key: m.id, media: m, caption: b.caption }] : [];
          }
          if (b.type === "gallery")
            return b.items.flatMap((it) => {
              const m = view.media[it.media];
              return m ? [{ key: m.id, media: m, caption: it.caption }] : [];
            });
          return [];
        });
        const places: PartPicture[] = (contexts.get(c.id)?.places ?? []).flatMap((p) =>
          p.image ? [{ key: p.image.mediaId, media: p.image }] : [],
        );
        const seen = new Set<string>(lead ? [lead] : []);
        const all = [...own, ...places].filter((p) => !seen.has(p.key) && seen.add(p.key));
        // A borrowed place picture leads only once on the page.
        const first = all.findIndex((p, i) => i < own.length || !leading.has(p.key));
        const ordered = first > 0 ? [all[first]!, ...all.filter((_, i) => i !== first)] : all;
        if (ordered[0]) leading.add(ordered[0].key);
        return [c.id, ordered.slice(0, 4)] as const;
      }),
    );
  }, [layout.chapters, contexts, view.media, spec.media]);

  // The years a claim's date may move the atlas to: the scrubber's range, or the era with some air
  // (a claim about a 19th-century decipherment should not redraw the map in 1838).
  const yearRange = useMemo<[number, number] | null>(() => {
    if (spec.atlas?.range) return spec.atlas.range;
    if (!within) return null;
    const pad = Math.max(20, Math.round((within[1] - within[0]) * 0.15));
    return [within[0] - pad, within[1] + pad];
  }, [spec.atlas?.range, within]);

  const [mapMovedTo, setMapMovedTo] = useState<number | null>(null);
  const select = useCallback(
    (id: string) => {
      if (selected === id) {
        setSelected(null);
        history.replaceState(null, "", window.location.pathname);
        return;
      }
      // Remember what opened the evidence, so closing it puts focus back there.
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body)
        opener.current = document.activeElement;
      setSelected(id);
      history.replaceState(null, "", `#claim-${id}`);
      // A dated claim shows the map in its year, and the evidence panel says so.
      const when = view.claims[id]?.when;
      let moved: number | null = null;
      if (when && yearRange) {
        const y = yearOf(dateBounds(when));
        if (y !== null && y >= yearRange[0] && y <= yearRange[1]) {
          bus.setYear(y, { fromReader: true });
          moved = y;
        }
      }
      setMapMovedTo(moved);
    },
    [selected, view.claims, yearRange, bus],
  );
  // Claims are linkable: /p/slug#claim-<id> opens the evidence (once, on arrival).
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    const m = /^#claim-(.+)$/.exec(window.location.hash);
    // A part's own #id (as /learn links "read Part 2 in full") opens it; any other #block inside a
    // folded part opens that part.
    const hashId = decodeURIComponent(window.location.hash.slice(1));
    if (!m && layout.chapters.some((c) => c.id === hashId && chapterBrief(c))) openPart(hashId);
    if (!m && window.location.hash.length > 1) {
      const target = document.getElementById(hashId);
      // Any target: open its part if folded, then hold it in view while the parts above settle.
      if (target) {
        reveal(target);
        requestAnimationFrame(() => requestAnimationFrame(() => scrollWhenSettled(target)));
      }
    }
    if (m && view.claims[m[1]!]) {
      select(m[1]!);
      // A claim only linked from prose has no #claim- element: find its link.
      // Open the part that holds it (its element may be folded, or only in the part's claim list).
      const holder = chapterOf.get(m[1]!);
      if (holder) openPart(holder.id);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const el = claimElement(m[1]!, holder?.id);
          if (el) scrollWhenSettled(el, { block: "center" });
        }),
      );
    }
    // The atlas keeps ?pin=<slug> in the address: arriving with one opens that place's card.
    else {
      const pinned = new URLSearchParams(window.location.search).get("pin");
      const e = pinned ? view.entities[pinned] : undefined;
      if (e) setSelectedEntity(e.id);
    }
  }, [view.claims, view.entities, select, reveal, chapterOf, openPart, layout.chapters]);

  const close = useCallback(() => {
    setSelected(null);
    history.replaceState(null, "", window.location.pathname);
    const back = opener.current;
    if (back?.isConnected) requestAnimationFrame(() => back.focus({ preventScroll: true }));
  }, []);
  const selectEntity = useCallback((id: string) => {
    setSelected(null);
    setSelectedEntity((cur) => (cur === id ? null : id));
  }, []);
  const closeEntity = useCallback(() => setSelectedEntity(null), []);
  const closeSheet = useCallback(() => {
    close();
    closeEntity();
  }, [close, closeEntity]);

  // Escape puts the context card back to "in this part" (popovers and the phone sheet handle their own).
  useEffect(() => {
    if (!desktop || (!selected && !selectedEntity)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (selected) close();
      else setSelectedEntity(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desktop, selected, selectedEntity, close]);

  // What is pinned on the atlas follows the selection: a claim's places, or the place picked.
  const located = useCallback(
    (c: ClaimCard | undefined) =>
      c ? [...new Set(c.entities.filter((e) => view.entities[e.id]?.geo).map((e) => e.id))] : [],
    [view.entities],
  );
  const { pin, clearPin, setEmphasis } = bus;
  // Only a selection going away clears the pin, so a pin the atlas restored from the address survives arrival.
  const hadPin = useRef(false);
  useEffect(() => {
    const ids = selected ? located(view.claims[selected]) : selectedEntity ? [selectedEntity] : [];
    if (ids.length) pin(ids, { toggle: false });
    else if (hadPin.current) clearPin();
    hadPin.current = ids.length > 0;
  }, [selected, selectedEntity, located, view.claims, pin, clearPin]);

  const selectedChapter = selected ? chapterOf.get(selected) : undefined;
  const step = useCallback(
    (delta: 1 | -1) => {
      if (!selected || !selectedChapter) return;
      const ids = selectedChapter.claimIds;
      const i = ids.indexOf(selected);
      const next = ids[(i + delta + ids.length) % ids.length];
      if (next) {
        select(next);
        const holder = chapterOf.get(next);
        if (holder) openPart(holder.id);
        requestAnimationFrame(() =>
          claimElement(next, holder?.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
        );
      }
    },
    [selected, selectedChapter, select, chapterOf, openPart],
  );

  // Reading quietly emphasises the chapter's places and people; nothing moves.
  const activeChapter = layout.chapters.find((c) => c.id === active) ?? layout.chapters[0];
  const activeIndex = activeChapter ? layout.chapters.indexOf(activeChapter) : -1;
  const activeCtx = activeChapter ? contexts.get(activeChapter.id) : undefined;
  useEffect(() => {
    setEmphasis(activeCtx ? [...activeCtx.places, ...activeCtx.people].map((e) => e.id) : []);
  }, [activeCtx, setEmphasis]);

  const allPlaces: MapFeature[] = useMemo(() => {
    const seen = new Set<string>();
    const out: MapFeature[] = [];
    for (const e of Object.values(view.entities)) {
      if (!e.geo || seen.has(e.id) || !PLACE_KINDS.includes(e.kind)) continue;
      seen.add(e.id);
      out.push({
        id: e.id,
        slug: e.slug,
        label: e.label,
        kind: e.kind,
        whenLabel: e.whenLabel,
        geo: e.geo,
      });
    }
    return out;
  }, [view.entities]);

  // People who are on the page only as writers about it (Megasthenes, Marx): drawn quietly on the atlas.
  const writers = useMemo(() => {
    const actors = new Set<string>();
    const wrote = new Set<string>();
    contexts.forEach((ctx) => {
      ctx.people.forEach((p) => actors.add(p.id));
      ctx.witnesses.forEach((p) => wrote.add(p.id));
    });
    return [...wrote].filter((id) => !actors.has(id));
  }, [contexts]);

  // Rivers the page names are drawn along their courses, matched by their names.
  const rivers = useMemo(
    () =>
      [...new Map(Object.values(view.entities).map((e) => [e.id, e])).values()]
        .filter((e) => e.slug.endsWith("-river"))
        .map((e) => ({ id: e.id, names: [e.label, ...e.aliases.map((a) => a.label)] })),
    [view.entities],
  );

  // Turning points label the place a claim is about on the map (atlas stops with a claim).
  const claimPlaces = useMemo(() => {
    const ids = new Set(allPlaces.map((p) => p.id));
    return Object.fromEntries(
      Object.values(view.claims).map((c) => [
        c.id,
        [...new Set(c.entities.map((e) => e.id).filter((id) => ids.has(id)))],
      ]),
    );
  }, [view.claims, allPlaces]);

  // The part being read may be about another year than the map shows: the atlas offers it
  // ("This part: c. 261 BCE · Show"), and only the reader moves the map.
  const { setSuggest } = bus;
  const activeBounds = activeChapter ? chapterBounds(activeChapter) : null;
  const activeYear = yearOf(activeBounds);
  // Parts about how we know (decipherment in the 1830s) are not offered: the map is of the period.
  const activeWhen =
    activeChapter &&
    !(activeChapter.head.type === "chapter" && activeChapter.head.phase === "later")
      ? chapterWhenLabel(activeChapter)
      : null;
  useEffect(() => {
    // On wide screens the rail offers the part's map ("You are in Part 5: show its map").
    if (desktop || !spec.atlas || activeYear === null || !activeWhen || bus.year === null)
      return setSuggest(null);
    const lo = Math.floor(activeBounds?.startMin ?? activeYear);
    const hi = Math.ceil(activeBounds?.endMax ?? activeYear);
    // Offered whenever the map shows a year outside the part's own dates.
    const far = bus.year < lo || bus.year > hi;
    setSuggest(far ? { year: activeYear, label: activeWhen } : null);
  }, [
    desktop,
    spec.atlas,
    activeYear,
    activeWhen,
    bus.year,
    setSuggest,
    activeBounds?.startMin,
    activeBounds?.endMax,
  ]);
  useEffect(() => () => setSuggest(null), [setSuggest]);

  const showYear = useCallback(
    (y: number) => {
      bus.setYear(y, { fromReader: true });
    },
    [bus, desktop],
  );

  const readerCtx: Reader = useMemo(
    () => ({
      selectClaim: select,
      selectedClaim: selected,
      claimText: (id: string) => view.claims[id]?.text,
      entity: (ref: string) => view.entities[ref],
      entityHref: (ref: string) => {
        const e = view.entities[ref];
        return e?.pageSlug ? `/p/${e.pageSlug}` : `/e/${e?.slug ?? ref}`;
      },
      within,
      selectEntity,
      selectedEntity,
      showYear: spec.atlas ? showYear : undefined,
      partFolded: (id: string) => (briefed.includes(id) ? !openParts.has(id) : undefined),
      revealMap: desktop
        ? undefined
        : () => {
            setMapOpen(true);
            requestAnimationFrame(() =>
              atlasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
            );
          },
    }),
    [
      select,
      selected,
      view.claims,
      view.entities,
      within,
      selectEntity,
      selectedEntity,
      spec.atlas,
      showYear,
      desktop,
      briefed,
      openParts,
    ],
  );

  // Key numbers for the hero.
  const total = view.stats.claims;
  const checked = view.stats.byLevel[2] + view.stats.byLevel[3] + view.stats.byLevel[4];
  const human = view.stats.byLevel[4];
  const sourceCount = useMemo(() => {
    const s = new Set<string>();
    for (const c of Object.values(view.claims))
      for (const cit of c.citations) s.add(cit.excerpt.source.id);
    return s.size;
  }, [view.claims]);
  const peopleCount = useMemo(
    () =>
      new Set(
        Object.values(view.entities)
          .filter((e) => e.kind === "person")
          .map((e) => e.id),
      ).size,
    [view.entities],
  );
  const placeCount = useMemo(
    () =>
      new Set(
        Object.values(view.entities)
          .filter((e) => PLACE_KINDS.includes(e.kind))
          .map((e) => e.id),
      ).size,
    [view.entities],
  );

  const deva = entity?.aliases.find((a) => a.script === "Deva");
  const ago = yearsAgo(entity?.bounds);
  const years = durationWords(entity?.bounds);
  const selectedClaim = selected ? view.claims[selected] : undefined;
  const pickedEntity = selectedEntity ? view.entities[selectedEntity] : undefined;
  const drawer = selectedClaim ? (
    <EvidenceDrawer
      claim={selectedClaim}
      mapYear={mapMovedTo}
      people={selectedClaim.entities.flatMap((e) => view.entities[e.id] ?? [])}
      position={
        selectedChapter
          ? {
              index: selectedChapter.claimIds.indexOf(selectedClaim.id),
              total: selectedChapter.claimIds.length,
              chapter: chapterTitle(selectedChapter),
            }
          : null
      }
      onClose={close}
      focusOnOpen={desktop}
      onStep={selectedChapter && selectedChapter.claimIds.length > 1 ? step : undefined}
    />
  ) : null;
  const placeCard = (onPhone: boolean) =>
    pickedEntity ? (
      <PlaceCard
        entity={pickedEntity}
        claims={claimsNaming(view, pickedEntity.id, claimOrder)}
        onSelectClaim={select}
        onClose={onPhone ? undefined : closeEntity}
        showMap={onPhone}
      />
    ) : null;

  const studyButton = (
    <Button
      variant="outline"
      size="sm"
      className="bg-paper"
      disabled={pending || total === 0}
      onClick={() =>
        start(async () => {
          const r = await addPageToDeckAction(page.id);
          if (r.ok) toast.success(r.message ?? "Added to your reviews.");
          else toast.error(r.error);
        })
      }
    >
      <GraduationCap data-icon="inline-start" /> Add this page to my reviews
    </Button>
  );

  const outlineItems: OutlineItem[] = useMemo(
    () =>
      layout.chapters.map((c) => {
        const b = chapterBounds(c);
        return {
          id: c.id,
          title: chapterTitle(c),
          promise: c.head.type === "chapter" ? (c.head.promise ?? null) : null,
          whenLabel: chapterWhenLabel(c) ?? chapterPhaseLabel(c),
          mark: b ? stripMark(b) : null,
          approximate: b?.approximate ?? false,
          later: c.head.type === "chapter" && c.head.phase === "later",
          seal: <ChapterProgressSeal view={view} chapterId={c.id} />,
        };
      }),
    [layout.chapters, view],
  );

  const intro = layout.intro.filter((b) => b.type === "prose");
  const introRest = layout.intro.filter((b) => b.type !== "prose");
  const inThisPart = spec.rail.includes("in_this_part") && activeChapter && activeCtx;
  const railNotes = spec.rail.includes("notes");
  const hasRail =
    spec.atlasIn === "rail" ||
    (spec.timelineIn === "rail" && within !== null) ||
    layout.chapters.length > 0 ||
    (railNotes && notes.length > 0);
  const outline = spec.outline;
  const pill = layout.chapters.length > 1 && (!outline || !wide);

  // While evidence or a place card is open, the map shrinks to a strip and the card gets the rail.
  const focusing = Boolean(selectedClaim || pickedEntity);
  const atlas = (variant: "rail" | "inline", height?: number, collapsed = false) =>
    spec.atlas ? (
      <Atlas
        title={page.title}
        spec={spec.atlas}
        focusEntityId={entity?.id ?? null}
        span={within}
        places={allPlaces}
        timeline={timeline}
        pageByEntity={pageByEntity}
        variant={variant}
        mapHeight={height}
        onSelectEntity={selectEntity}
        claimPlaces={claimPlaces}
        writers={writers}
        rivers={rivers}
        collapsed={collapsed}
      />
    ) : null;
  const periodTimeline =
    within && entity ? (
      <Panel
        title="Where in time"
        action={
          <Link
            href="/timeline"
            className="font-sans text-sm text-indigo no-underline hover:underline"
          >
            Full timeline
          </Link>
        }
      >
        <PeriodTimeline
          items={timeline}
          focus={{
            from: spec.timelineRange?.[0] ?? within[0],
            to: spec.timelineRange?.[1] ?? within[1],
            id: entity.id,
            label: entity.label,
          }}
          pageByEntity={pageByEntity}
          height={240}
        />
      </Panel>
    ) : null;

  // The context card: evidence for the claim picked, else the place picked, else this part.
  const cardKey = selectedClaim
    ? `claim:${selectedClaim.id}`
    : pickedEntity
      ? `entity:${pickedEntity.id}`
      : `part:${activeChapter?.id ?? ""}`;
  // "Show its map": the reader asks, and the map goes to the part's year and frames its places.
  const activePlaces = activeCtx ? activeCtx.places.filter((p) => p.geo).map((p) => p.id) : [];
  const activeMapYear =
    activeChapter && !(activeChapter.head.type === "chapter" && activeChapter.head.phase === "later")
      ? activeYear
      : null;
  const showPartMap =
    spec.atlas && spec.atlasIn === "rail" && (activeMapYear !== null || activePlaces.length > 0)
      ? {
          year: activeMapYear !== null ? formatYear(activeMapYear) : null,
          go: () => {
            if (activeMapYear !== null) bus.setYear(activeMapYear, { fromReader: true });
            if (activePlaces.length) pin(activePlaces, { toggle: false });
          },
        }
      : null;
  // Beside the summary at 1280px and up (while the part is folded), so the rail shows the others.
  const activePictures = activeChapter
    ? (partPictures.get(activeChapter.id) ?? []).slice(wide && !isOpen(activeChapter) ? 1 : 0)
    : [];
  const contextCard = drawer ? (
    <div className="floating p-4">{drawer}</div>
  ) : pickedEntity ? (
    <div className="floating p-4">{placeCard(false)}</div>
  ) : inThisPart ? (
    <InThisPart
      showMap={showPartMap}
      pictures={activePictures.slice(0, 3)}
      index={activeIndex}
      title={chapterTitle(activeChapter)}
      people={activeCtx.people}
      witnesses={activeCtx.witnesses}
      places={activeCtx.places}
      terms={activeCtx.terms}
      within={within}
      ask={
        <AskAi
          subject={{
            type: "chapter",
            page: page.slug,
            chapter: activeChapter.id,
            label: chapterTitle(activeChapter),
            pageTitle: page.title,
          }}
          label="Ask your AI about this part"
        />
      }
    />
  ) : null;

  const heroPanels = spec.hero
    .map((p): { key: string; node: React.ReactNode } | null => {
      // The lead image sits beside the lede (below it on narrower screens), not in this stack.
      if (p === "media") return null;
      if (p === "already_know")
        return layout.alreadyKnow
          ? { key: p, node: <AlreadyKnow block={layout.alreadyKnow} view={view} wide /> }
          : null;
      if (p === "atlas" && spec.atlasIn === "hero")
        return {
          key: p,
          node: <div ref={atlasRef}>{atlas("inline")}</div>,
        };
      if (p === "timeline" && spec.timelineIn === "hero")
        return periodTimeline ? { key: p, node: periodTimeline } : null;
      return null;
    })
    .filter((x): x is { key: string; node: React.ReactNode } => x !== null);
  const lead = spec.hero.includes("media")
    ? (media ??
      (spec.media && view.media[spec.media] ? (
        <LeadImage media={view.media[spec.media]!} className="max-sm:order-first xl:mt-1.5" />
      ) : null))
    : null;

  // Skim (the short versions) or read in full; offered in the hero and the outline.
  const skimming = briefed.length > 0 && briefed.every((id) => !openParts.has(id));
  const phoneSkim = !desktop && skimming;
  // The year the atlas opens on, for the borders under a part with no date of its own.
  const pageYear = initialYear ?? spec.atlas?.initialYear ?? null;
  const skimmedCount =
    learning.status === "ready"
      ? briefed.filter(
          (id) => learning.data.chapters[id]?.skimmed || learning.data.chapters[id]?.read,
        ).length
      : 0;
  const readMode = (compact = false) =>
    briefed.length > 0 ? (
      <div
        role="group"
        aria-label="How to read this page"
        className={cn(
          "inline-flex rounded-md border border-rule bg-paper p-0.5 font-sans",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {(
          [
            // Short words name what each opens, in the parts' own words ("the summary", "the whole part").
            ["skim", "Skim all parts", "Summaries", skimMinutes],
            ["full", "Read in full", "Whole parts", fullMinutes],
          ] as const
        ).map(([mode, long, short, mins]) => {
          const on = mode === "full" ? briefed.every((id) => openParts.has(id)) : skimming;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={on}
              onClick={() => setOpenParts(saveParts(new Set(mode === "full" ? briefed : [])))}
              className={cn(
                "rounded-[5px] transition-colors",
                compact ? "px-2 py-1" : "px-3 py-1.5",
                on ? "bg-indigo-wash font-medium text-indigo" : "text-ink-2 hover:text-ink",
              )}
            >
              {compact ? (
                short
              ) : (
                <>
                  {/* Short words below 640px, so "min" never sits alone on a line. */}
                  <span className="hidden whitespace-nowrap sm:inline">
                    {long}, about {mins} min
                  </span>
                  <span className="whitespace-nowrap sm:hidden">
                    {short}, {mins} min
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <ReaderContext.Provider value={readerCtx}>
      <Frame className={cn(ERA_GRID({ outline, rail: hasRail }), "pt-6 sm:pt-8 lg:pt-10")}>
        {/* ---------------------------------------------------------- orientation */}
        <header className="era-hero min-w-0 pb-2 lg:pb-6">
          {layout.chapters[0] && (
            <a
              href={`#${layout.chapters[0].id}`}
              onClick={(e) => jumpTo(layout.chapters[0]!.id, e)}
              className="visually-hidden focus:not-sr-only focus:absolute focus:z-30 focus:rounded-md focus:bg-paper focus:px-3 focus:py-2 focus:font-sans focus:text-sm focus:shadow-pop"
            >
              Skip to the story
            </a>
          )}
          <AiChangeNotice className="mb-3" />
          {/* The line is time (docs/visual.md §1): every age, this one lit, "age 5 of 16" linking to the list. */}
          {ageLine ?? (
            <Link
              href="/p/ages-of-indian-history"
              className="font-sans text-ui text-ink-2 no-underline hover:text-ink hover:underline"
            >
              Ages of Indian history
            </Link>
          )}

          {/* Display size; the Devanagari is the same size beside it, in ink-2 (docs/visual.md §2). */}
          <h1 className="mt-5 text-4xl tracking-[-0.02em] text-ink">
            {page.title}
            {deva && (
              <span
                className="mt-1 block font-deva font-normal tracking-normal text-ink-2 sm:mt-0 sm:ml-4 sm:inline"
                lang={deva.lang}
                title={deva.note}
              >
                {deva.label}
              </span>
            )}
          </h1>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {entity?.whenLabel && (
              <span className="font-heading text-xl text-ink tnum sm:text-2xl">
                {entity.whenLabel}
              </span>
            )}
            {(ago || years) && (
              <span className="font-sans text-ui text-ink-2">
                {ago}
                {ago && years ? ", " : ""}
                {years ? `lasting ${years}` : ""}
              </span>
            )}
          </div>
          <AskAi subject={{ type: "page", page: page.slug, label: page.title }} className="mt-4" />

          <div
            className={cn(
              "mt-7",
              lead && "grid gap-x-10 gap-y-7 xl:grid-cols-[minmax(0,1fr)_minmax(15rem,24rem)]",
            )}
          >
            <div className="max-w-[64ch] space-y-5 text-lg leading-[1.6] text-ink [&>*:first-child_p:first-child]:text-[1.3rem] [&>*:first-child_p:first-child]:leading-[1.5]">
              {intro.map((b) =>
                b.type === "prose" ? (
                  <Markdown key={b.id} className="space-y-5">
                    {b.markdown}
                  </Markdown>
                ) : null,
              )}
              {intro.length === 0 && page.summary && <p>{page.summary}</p>}
            </div>
            {lead}
          </div>

          {total > 0 && (
            <ul
              aria-label="This page in numbers"
              className="mt-8 flex flex-wrap gap-x-7 gap-y-3 font-sans text-sm text-ink-2"
            >
              <li className="flex items-center gap-2.5">
                <EvidenceSeal level={human === total ? 4 : checked === total ? 2 : 1} />
                <span>
                  <span className="font-medium text-ink tnum">{total}</span> claims
                  {checked === total
                    ? ", every quote found in its source"
                    : `, ${checked} with the quote found in the source`}
                </span>
                <Popover>
                  <PopoverTrigger className="rounded-sm text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo">
                    What the squares mean
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <p className="mb-2 font-sans text-ui font-semibold text-ink">
                      The evidence seal
                    </p>
                    <SealLadder
                      level={human === total ? 4 : checked === total ? 2 : 1}
                      here={
                        checked === total
                          ? "Every claim on this page has reached at least this step."
                          : null
                      }
                    />
                    <p className="mt-2 font-sans text-xs text-ink-3">
                      The small icon after the squares is the kind of source: an inscription, an old
                      text, scholarship or a reference work.
                    </p>
                  </PopoverContent>
                </Popover>
              </li>
              {sourceCount > 0 && (
                <li>
                  <span className="font-medium text-ink tnum">{sourceCount}</span>{" "}
                  {sourceCount === 1 ? "source" : "sources"}
                </li>
              )}
              {peopleCount > 0 && (
                <li>
                  <span className="font-medium text-ink tnum">{peopleCount}</span>{" "}
                  {peopleCount === 1 ? "person" : "people"}
                </li>
              )}
              {placeCount > 0 && (
                <li>
                  <span className="font-medium text-ink tnum">{placeCount}</span>{" "}
                  {placeCount === 1 ? "place" : "places"}
                </li>
              )}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            {readMode()}
            <CustomiseButton
              panels={ERA_VIEW_PANELS.filter((p) =>
                p === "atlas"
                  ? Boolean(view.page.spec.atlas)
                  : p === "timeline"
                    ? !view.page.spec.atlas
                    : p === "meanwhile"
                      ? Boolean(layout.meanwhile)
                      : true,
              )}
              stops={publishedStops}
              hasAtlas={Boolean(spec.atlas)}
              reading={briefed.length > 0}
            />
            {briefed.length > 0 && skimmedCount > 0 && (
              <span className="font-sans text-sm text-ink-3 tnum">
                You have skimmed {skimmedCount} of {briefed.length} parts
              </span>
            )}
            {total > 0 && studyButton}
          </div>

          {(heroPanels.length > 0 || showMeanwhile) &&
            (() => {
              const panels = (
                <div className="grid gap-4">
                  {heroPanels.map((p) => (
                    <Fragment key={p.key}>{p.node}</Fragment>
                  ))}
                  {showMeanwhile && layout.meanwhile && (
                    <Meanwhile block={layout.meanwhile} onSelect={select} selected={selected} />
                  )}
                </div>
              );
              // The story should start on the first screens. On wide screens the names fold to one
              // row of chips (tools such as a hero map stay open); on a phone everything folds.
              if (desktop) {
                const tools = heroPanels.filter((p) => p.key !== "already_know");
                const known = heroPanels.some((p) => p.key === "already_know") ? layout.alreadyKnow : null;
                const names = known ? known.items.flatMap((it) => view.entities[it.entity] ?? []) : [];
                const folded = Boolean(known) || showMeanwhile;
                return (
                  <>
                    {tools.length > 0 && (
                      <div className="mt-9 grid gap-4">
                        {tools.map((p) => (
                          <Fragment key={p.key}>{p.node}</Fragment>
                        ))}
                      </div>
                    )}
                    {folded && (
                      <BeforeYouStart
                        title={known?.title ?? (known ? "Names you'll meet" : "Meanwhile elsewhere")}
                        names={names}
                        within={within}
                        more={names.length && showMeanwhile ? "Who they are, and what else was happening" : names.length ? "Who they are" : "What else was happening"}
                      >
                        <div className="grid gap-4">
                          {known && <AlreadyKnow block={known} view={view} wide titled={false} />}
                          {showMeanwhile && layout.meanwhile && (
                            <Meanwhile block={layout.meanwhile} onSelect={select} selected={selected} />
                          )}
                        </div>
                      </BeforeYouStart>
                    )}
                  </>
                );
              }
              return (
                <Disclosure
                  summary="Before you start: names you'll meet, and what else was happening"
                  className="mt-7 border-y border-rule py-2"
                  triggerClassName="text-ui"
                >
                  <div className="pb-2">{panels}</div>
                </Disclosure>
              );
            })()}
        </header>

        {/*
         * Phones and tablets: the map folds into one line after the orientation (open on
         * request, or when the reader picks a date or "See it"), so the story is not pushed
         * a screen down by tools. Study notes go after the chapters.
         */}
        {!desktop && (spec.atlasIn === "rail" || spec.timelineIn === "rail") && (
          <div
            ref={atlasRef}
            className="min-w-0 scroll-mt-[calc(var(--topbar-h)+1rem)] border-y border-rule lg:hidden"
          >
            <button
              type="button"
              onClick={() => setMapOpen((o) => !o)}
              aria-expanded={mapOpen}
              className="flex w-full items-center gap-3 px-4 py-3 text-left font-sans"
            >
              <MapIcon className="size-4 shrink-0 text-indigo" aria-hidden />
              <span className="min-w-0 flex-1 text-ui font-medium text-ink">
                {spec.atlasIn === "rail" ? "Map and timeline" : "Where in time"}
                {spec.atlasIn === "rail" && bus.year !== null && (
                  <span className="ml-2 font-normal text-ink-3 tnum">{formatYear(bus.year)}</span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 text-ink-3 transition-transform duration-200",
                  mapOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            {mapOpen && (
              <div className="px-3 pb-3">
                {spec.atlasIn === "rail" ? atlas("inline", 260) : periodTimeline}
              </div>
            )}
          </div>
        )}

        {outline && (
          <div className="era-outline hidden xl:block">
            <div className="scroll-thin sticky top-[calc(var(--topbar-h)+1.5rem)] max-h-[calc(100dvh-var(--topbar-h)-2.5rem)] overflow-y-auto pb-4">
              <Outline
                items={outlineItems}
                active={active}
                within={within}
              />
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- chapters */}
        {/* Prose on the page, no card around the parts (docs/visual.md §5). */}
        <article className="era-body min-w-0 pt-2">
          {introRest.length > 0 && (
            <div
              className={cn(
                "space-y-7",
                layout.chapters.length > 0 && "mb-14 max-w-[66ch] border-b border-rule pb-12",
              )}
            >
              {introRest.map((b) =>
                // On the overview, the list of ages is the page: an index with dates and what each age was.
                page.kind === "overview" && b.type === "entities" ? (
                  <AgesIndex
                    key={b.id}
                    title={b.title}
                    ages={b.entityIds
                      .map((id) => view.entities[id])
                      .filter((e): e is EntityCard => Boolean(e))}
                  />
                ) : (
                  <div key={b.id} className="max-w-[66ch]">
                    <BlockView block={b} view={view} selected={selected} onSelect={select} />
                  </div>
                ),
              )}
            </div>
          )}
          <p aria-live="polite" className="visually-hidden">
            {announcement}
          </p>
          {layout.chapters.map((c, i) => {
            const ctx = contexts.get(c.id)!;
            const when = chapterWhenLabel(c);
            const b = chapterBounds(c);
            return (
              <section
                key={c.id}
                id={c.id}
                ref={(el) => {
                  if (el) sections.current.set(c.id, el);
                  else sections.current.delete(c.id);
                }}
                className={cn(
                  "scroll-mt-[calc(var(--topbar-h)+1.5rem)]",
                  // Phone skim reader: parts follow one another closely, each as tall as its summary.
                  phoneSkim && chapterBrief(c)
                    ? i > 0 && "mt-10 border-t border-rule pt-8"
                    : i > 0 && "mt-16 border-t border-rule pt-14",
                )}
              >
                <p className="font-sans text-ui text-ink-2 tnum">
                  Part {i + 1} of {layout.chapters.length}
                </p>
                <h2
                  id={`${c.id}-title`}
                  tabIndex={-1}
                  className="mt-1.5 max-w-[30ch] scroll-mt-28 rounded-sm text-2xl text-ink outline-none"
                >
                  {chapterTitle(c)}
                </h2>
                {(when || ctx.places.length > 0 || ctx.people.length > 0) &&
                  !(phoneSkim && chapterBrief(c) && !isOpen(c)) && (
                    <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&>*]:shrink-0">
                      {when && (
                        <DateChip
                          label={when}
                          about={(() => {
                            const ev = ctx.places.find((p) => p.kind === "event");
                            return ev ? { label: ev.label, href: `/e/${ev.slug}` } : null;
                          })()}
                          bounds={b}
                          within={within}
                          asStated={
                            c.head.type === "chapter" && c.head.when && "asStated" in c.head.when
                              ? c.head.when.asStated?.text
                              : null
                          }
                        />
                      )}
                      {/* One row of at most five tags (date, places, people), then "+n" (docs/visual.md §4). */}
                      {(() => {
                        const room = when ? 4 : 5;
                        const all = [...ctx.places, ...ctx.people];
                        const shown = all.length > room ? all.slice(0, room - 1) : all;
                        const rest = all.slice(shown.length);
                        return (
                          <>
                            {shown.map((p) => (
                              <EntityChip
                                key={p.id}
                                entity={p}
                                within={ctx.people.includes(p) ? within : undefined}
                              />
                            ))}
                            {rest.length > 0 && (
                              <Badge
                                variant="neutral"
                                className="h-7 self-center px-2 text-sm"
                                title={rest.map((p) => p.label).join(", ")}
                              >
                                +{rest.length}
                                <span className="sr-only">
                                  : {rest.map((p) => p.label).join(", ")}
                                </span>
                              </Badge>
                            )}
                          </>
                        );
                      })()}
                      <AddToCanvas
                        content={{ kind: "chapter", page: page.slug, chapterId: c.id }}
                        what={`Part ${i + 1}, ${chapterTitle(c)}`}
                        icon
                        size="xs"
                        className="self-center"
                      />
                      <YourNoteButton blockId={c.id} what={`Part ${i + 1}`} icon />
                    </div>
                  )}
                <YourPartExtras blockId={c.id} notes={notes} />
                {(() => {
                  const brief = chapterBrief(c);
                  // With a one-minute version, a leading "guess first" stays above it (guess, then the
                  // short version, then the choice to read on); everything else folds.
                  const firstOther = c.blocks.findIndex((x) => x.type !== "guess");
                  const lead = brief
                    ? c.blocks.slice(0, firstOther < 0 ? c.blocks.length : firstOther)
                    : [];
                  const open = isOpen(c);
                  // Folded, the part's "Check yourself" line sits with the brief; open, in its place.
                  const checkBlock =
                    brief && !open
                      ? c.blocks.find(
                          (x): x is Extract<Block, { type: "check" }> => x.type === "check",
                        )
                      : undefined;
                  // Folded, a leading "guess first" is one line above the summary; open, a field above the part.
                  const guessLine =
                    brief && !open
                      ? (lead.find((x): x is GuessBlock => x.type === "guess") ?? null)
                      : null;
                  const picture = brief && !open ? partPictures.get(c.id)?.[0] : undefined;
                  const rest = c.blocks.slice(lead.length).filter((x) => x !== checkBlock);
                  const partYear =
                    c.head.type === "chapter" && c.head.phase === "later"
                      ? null
                      : yearOf(chapterBounds(c));
                  const nextPart = layout.chapters[i + 1];
                  const nextYear =
                    nextPart &&
                    !(nextPart.head.type === "chapter" && nextPart.head.phase === "later")
                      ? yearOf(chapterBounds(nextPart))
                      : null;
                  const blocksBody = (
                    <div className="mt-7 max-w-[66ch] space-y-7">
                      {rest.map((block) => {
                        if (block.type === "meanwhile")
                          return (
                            <Meanwhile
                              key={block.id}
                              block={block}
                              onSelect={select}
                              selected={selected}
                            />
                          );
                        // A claim list repeats only the claims the prose has not already linked.
                        if (block.type === "claims" || block.type === "key_facts") {
                          const rest = block.claimIds.filter((id) => !inProse.get(c.id)?.has(id));
                          if (!rest.length) return null;
                          // A long list shows its first three; the rest fold away (still in "All claims").
                          const shown = rest.length > 4 ? rest.slice(0, 3) : rest;
                          return (
                            <div key={block.id}>
                              <BlockView
                                block={{ ...block, claimIds: shown }}
                                view={view}
                                selected={selected}
                                onSelect={select}
                              />
                              {shown.length < rest.length && (
                                <Disclosure
                                  summary={`${rest.length - shown.length} more`}
                                  className="mt-1"
                                  triggerClassName="text-sm"
                                >
                                  <ul className="-ml-4 space-y-0.5">
                                    {rest.slice(shown.length).map((id) => (
                                      <ClaimItem
                                        key={id}
                                        claim={view.claims[id]}
                                        selected={selected === id}
                                        onSelect={select}
                                      />
                                    ))}
                                  </ul>
                                </Disclosure>
                              )}
                            </div>
                          );
                        }
                        return (
                          <BlockView
                            key={block.id}
                            block={block}
                            view={view}
                            selected={selected}
                            onSelect={select}
                          />
                        );
                      })}
                      {c.claimIds.length > 1 && (
                        <AllClaims chapter={c} view={view} selected={selected} onSelect={select} />
                      )}
                    </div>
                  );
                  if (!brief) return blocksBody;
                  return (
                    <>
                      {lead.length > 0 && !guessLine && (
                        <div className="mt-7 max-w-[66ch] space-y-7">
                          {lead.map((block) => (
                            <BlockView
                              key={block.id}
                              block={block}
                              view={view}
                              selected={selected}
                              onSelect={select}
                            />
                          ))}
                        </div>
                      )}
                      <PartBrief
                        id={`brief-${c.id}`}
                        label={`Part ${i + 1} in a minute: ${chapterTitle(c)}`}
                        happened={brief.happened}
                        howWeKnow={brief.howWeKnow}
                        open={open}
                        onToggle={() => togglePart(c.id)}
                        length={`about ${readingMinutes(partSeconds.get(c.id) ?? 0)} min`}
                        view={view}
                        chapterId={c.id}
                        guess={guessLine}
                        picture={
                          picture && wide ? (
                            <div className="h-[15rem]">
                              <MediaTile media={picture.media} caption={picture.caption} />
                            </div>
                          ) : null
                        }
                        check={
                          checkBlock ? (
                            <CheckView
                              block={checkBlock}
                              view={view}
                              selected={selected}
                              onSelect={select}
                              guesses={guessPlacements(view.page.blocks).inCheck.get(checkBlock.id) ?? []}
                              quiet
                            />
                          ) : null
                        }
                        onShowOnMap={
                          spec.atlas && partYear !== null
                            ? {
                                year: formatYear(partYear),
                                go: () => bus.setYear(partYear, { fromReader: true }),
                              }
                            : null
                        }
                        next={
                          nextPart
                            ? {
                                label: `Part ${i + 2}`,
                                mapYear:
                                  spec.atlas && nextYear !== null ? formatYear(nextYear) : null,
                                onGo: () => goToPart(nextPart, i + 1, nextYear),
                              }
                            : null
                        }
                      />
                      {phoneSkim && !open && (
                        <PartMapThumb
                          places={ctx.places.flatMap((p) =>
                            p.geo
                              ? [
                                  {
                                    id: p.id,
                                    slug: p.slug,
                                    label: p.label,
                                    kind: p.kind,
                                    whenLabel: p.whenLabel,
                                    geo: p.geo,
                                  },
                                ]
                              : [],
                          )}
                          // A part with no date of its own shows the borders of the year the atlas opens on.
                          year={partYear ?? pageYear}
                          yearLabel={
                            partYear === null && pageYear !== null
                              ? `Borders of ${formatYear(pageYear)}`
                              : chapterWhenLabel(c)
                          }
                          focusEntityId={entity?.id}
                        />
                      )}
                      <PartBody open={open} onReveal={() => openPart(c.id)}>
                        {blocksBody}
                      </PartBody>
                    </>
                  );
                })()}
              </section>
            );
          })}
          {briefed.length > 0 &&
            skimmedCount >= briefed.length &&
            briefed.some((id) => !openParts.has(id)) && (
              <WhatNext
                chapters={layout.chapters}
                view={view}
                guesses={learning.status === "ready" ? learning.data.guesses : {}}
                openParts={openParts}
                onRead={(c) => {
                  openPart(c.id);
                  jumpTo(c.id);
                }}
              />
            )}
          {!desktop && notes.length > 0 && !yv?.hides("notes") && (
            <div className="mt-12">
              <NotesPanel notes={notes} fresh={fresh} onDismiss={dismissNote} />
            </div>
          )}
        </article>

        {/* ---------------------------------------------------------- the rail: atlas and context card (wide screens) */}
        {hasRail && (
          // After the reading in the DOM (keyboard and screen readers meet the story first); the grid places it beside.
          <aside
            id="era-rail"
            className="era-rail hidden min-w-0 lg:block"
            aria-label="Map and context"
          >
            <a
              href="#era-context"
              className="visually-hidden focus:not-sr-only focus:absolute focus:z-30 focus:rounded-md focus:bg-paper focus:px-3 focus:py-2 focus:font-sans focus:text-sm focus:shadow-pop"
            >
              Skip the map
            </a>
            <div className="sticky top-[calc(var(--topbar-h)+1rem)] flex h-[calc(100dvh-var(--topbar-h)-2rem)] flex-col gap-3">
              {desktop && spec.atlasIn === "rail" && (
                <div className="shrink-0">{atlas("rail", mapHeight, focusing)}</div>
              )}
              {spec.timelineIn === "rail" && <div className="shrink-0">{periodTimeline}</div>}
              <div
                id="era-context"
                tabIndex={-1}
                className="scroll-thin -mx-1 min-h-0 flex-1 overflow-y-auto outline-none overscroll-contain px-1 pb-8 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.75rem),transparent)]"
              >
                {contextCard && (
                  <div
                    key={cardKey}
                    className="animate-in fade-in duration-200 ease-[var(--ease-out-quart)]"
                  >
                    {contextCard}
                  </div>
                )}
                {railNotes && notes.length > 0 && (
                  <div className={cn(contextCard && "mt-3")}>
                    <NotesPanel notes={notes} fresh={fresh} onDismiss={dismissNote} />
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}

        {/* ---------------------------------------------------------- phones and tablets: the atlas, then the chapters */}
      </Frame>

      {/* Narrower screens: chapters in a popover from a floating pill. */}
      {pill && (
        <div
          className={cn(
            // Under the top bar, where the reader has already read, not over the line being read.
            "pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-h)+0.5rem)] z-20 flex justify-center transition-[opacity,translate] duration-200 lg:justify-start lg:pl-[max(var(--gutter),env(safe-area-inset-left))]",
            pillShown || outlineOpen
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-3 opacity-0 [&_*]:pointer-events-none",
          )}
          {...(pillShown || outlineOpen ? {} : { inert: true })}
        >
          <Popover open={outlineOpen} onOpenChange={setOutlineOpen}>
            <PopoverTrigger className="floating pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full px-3.5 font-sans text-sm font-medium text-ink aria-expanded:bg-rule-soft">
              <List className="size-4 text-indigo" aria-hidden />
              {activeIndex >= 0 ? (
                <span className="max-w-[56vw] truncate">
                  <span className="text-ink-3 tnum">{activeIndex + 1}.</span>{" "}
                  {chapterTitle(activeChapter!)}
                </span>
              ) : (
                "Chapters"
              )}
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="center"
              className="scroll-thin max-h-[70dvh] w-[min(92vw,24rem)] overflow-y-auto p-2"
            >
              <Outline
                items={outlineItems}
                active={active}
                within={within}
                dense
                onNavigate={() => setOutlineOpen(false)}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
      {!desktop && (
        <Drawer
          open={Boolean(selectedClaim || pickedEntity)}
          onOpenChange={(o) => !o && closeSheet()}
          showSwipeHandle
        >
          <DrawerContent
            aria-modal="true"
            finalFocus={opener}
            className="max-h-[88dvh] px-4 pb-[calc(1.5rem+var(--safe-bottom))]"
          >
            <DrawerTitle className="sr-only">
              {selectedClaim ? "Evidence" : (pickedEntity?.label ?? "Details")}
            </DrawerTitle>
            <div className="scroll-thin overflow-y-auto">{drawer ?? placeCard(true)}</div>
          </DrawerContent>
        </Drawer>
      )}

      {page.blocks.length > 0 && view.stats.pendingChangesets > 0 && (
        <Frame className="mt-8 font-sans text-sm">
          <Link
            href="/review"
            className="inline-flex items-center gap-1 text-turmeric-ink no-underline hover:underline"
          >
            {view.stats.pendingChangesets} proposed{" "}
            {view.stats.pendingChangesets === 1 ? "change" : "changes"} to this page waiting for
            review <ChevronRight className="size-3.5" />
          </Link>
        </Frame>
      )}
    </ReaderContext.Provider>
  );
}

/**
 * Before the story, on wide screens: the names the page turns on as one row of chips, and a control
 * that opens who they are (and what else was happening) under it.
 */
function BeforeYouStart({
  title,
  names,
  within,
  more,
  children,
}: {
  title: string;
  names: EntityCard[];
  within: [number, number] | null;
  more: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shown = names.length > 6 ? names.slice(0, 5) : names;
  const rest = names.length - shown.length;
  return (
    <section aria-labelledby="before-you-start" className="mt-8 border-y border-rule py-2.5">
      <div className="flex items-center gap-x-3">
        <h2 id="before-you-start" className="shrink-0 font-sans text-ui font-semibold text-ink">
          {title}
        </h2>
        <ul className="flex min-w-0 flex-1 gap-1.5 overflow-hidden py-0.5 [&>*]:shrink-0">
          {shown.map((e) => (
            <li key={e.id}>
              <EntityChip entity={e} within={e.kind === "person" ? within : undefined} />
            </li>
          ))}
          {rest > 0 && (
            <li className="self-center font-sans text-sm text-ink-3 tnum">and {rest} more</li>
          )}
        </ul>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="before-you-start-more"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex shrink-0 items-center gap-1 rounded-sm font-sans text-sm text-indigo hover:underline"
        >
          {open ? "Fold" : more}
          <ChevronDown className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} aria-hidden />
        </button>
      </div>
      <div id="before-you-start-more" hidden={!open} className="pt-4 pb-1.5">
        {open && children}
      </div>
    </section>
  );
}

/** "Names you'll meet": the people and places the page turns on, each with one line and a jump into the page. */
function AlreadyKnow({
  block,
  view,
  wide,
  titled = true,
}: {
  block: Extract<Block, { type: "already_know" }>;
  view: PageView;
  wide: boolean;
  /** Off inside the "Before you start" strip, whose own heading names it. */
  titled?: boolean;
}) {
  return (
    <section
      className={cn("min-w-0", titled && "border-t border-rule pt-4")}
      aria-labelledby={titled ? "already-know" : "before-you-start"}
    >
      {titled && (
        <h2 id="already-know" className="font-sans text-ui font-semibold tracking-[-0.01em] text-ink">
          {block.title ?? "Names you'll meet"}
        </h2>
      )}
      <ul className={cn("grid gap-x-8", titled && "mt-3", wide && "sm:grid-cols-2")}>
        {block.items.map((item, i) => (
          <AlreadyKnowItem key={i} item={item} entity={view.entities[item.entity]} />
        ))}
      </ul>
    </section>
  );
}

function AlreadyKnowItem({
  item,
  entity,
}: {
  item: Extract<Block, { type: "already_know" }>["items"][number];
  entity: EntityCard | undefined;
}) {
  const point = usePointAt(entity ? [entity.id] : undefined);
  return (
    <li className="border-t border-rule-soft py-3" {...point}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-heading text-lg leading-tight text-ink">
          {entity?.label ?? item.entity}
        </span>
        {entity?.whenLabel && (
          <span className="font-sans text-xs text-ink-3 tnum">{datedLabel(entity)}</span>
        )}
      </p>
      <div className="mt-1 font-sans text-note leading-snug text-ink-2">
        <Markdown className="inline [&_p]:inline">{item.text}</Markdown>
        {item.target && (
          <a
            href={`#${item.target}`}
            onClick={(e) => jumpTo(item.target!, e)}
            aria-label={`${item.targetLabel ?? "Read more"}, for ${entity?.label ?? item.entity}`}
            className="mt-1.5 flex w-fit items-center gap-1 text-sm text-indigo no-underline hover:underline"
          >
            <ArrowDown className="size-3.5" aria-hidden /> {item.targetLabel ?? "Read more"}
          </a>
        )}
      </div>
    </li>
  );
}

/** What was happening elsewhere at the same time, each line grounded in a claim. */
function Meanwhile({
  block,
  onSelect,
  selected,
}: {
  block: Extract<Block, { type: "meanwhile" }>;
  onSelect: (id: string) => void;
  selected: string | null;
}) {
  return (
    <aside className="border-t border-rule pt-4" aria-label={block.title ?? "Meanwhile elsewhere"}>
      <h3 className="font-sans text-ui font-semibold text-ink">
        {block.title ?? "Meanwhile elsewhere"}
      </h3>
      <ul className="mt-3 divide-y divide-rule-soft font-sans">
        {block.items.map((m, i) => (
          <li key={i} className="grid grid-cols-[6.5rem_1fr] gap-x-4 py-2 text-note">
            <span className="text-ink-3">{m.region}</span>
            <span className="text-ink">
              {m.claimIds[0] ? (
                <a
                  href={`#claim-${m.claimIds[0]}`}
                  aria-current={selected === m.claimIds[0] ? "true" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    onSelect(m.claimIds[0]!);
                  }}
                  className="claim-link"
                >
                  {m.label}
                </a>
              ) : (
                m.label
              )}
            </span>
          </li>
        ))}
      </ul>
      {block.note && <p className="mt-3 font-sans text-sm leading-snug text-ink-3">{block.note}</p>}
    </aside>
  );
}

/** Every claim in a part, folded away: what to check or study, without restating the prose. */
function AllClaims({
  chapter,
  view,
  selected,
  onSelect,
}: {
  chapter: Chapter;
  view: PageView;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Disclosure
      summary={`All ${chapter.claimIds.length} claims in this part, with their evidence`}
      className="border-t border-rule-soft pt-1.5"
      triggerClassName="text-sm"
    >
      <ul className="-ml-1 space-y-0.5 pb-1">
        {chapter.claimIds.map((id) => (
          <ClaimItem
            key={id}
            claim={view.claims[id]}
            selected={selected === id}
            onSelect={onSelect}
            anchor={false}
          />
        ))}
      </ul>
    </Disclosure>
  );
}

/**
 * After the last short version: the outline is in hand; suggest the part
 * worth reading in full, the one where the learner's guess was furthest off.
 */
function WhatNext({
  chapters,
  view,
  guesses,
  openParts,
  onRead,
}: {
  chapters: Chapter[];
  view: PageView;
  guesses: Record<string, { response: Parameters<typeof guessWords>[1] }>;
  openParts: Set<string>;
  onRead: (c: Chapter) => void;
}) {
  const scored = chapters
    .map((c, i) => {
      const g = c.blocks.find(
        (b): b is Extract<Block, { type: "guess" }> => b.type === "guess" && Boolean(guesses[b.id]),
      );
      if (!g || openParts.has(c.id)) return null;
      const r = guesses[g.id]!.response;
      return { c, i, g, r, d: guessDistance(g.answer, r) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.d - a.d);
  const best = scored[0] && scored[0].d > 0 ? scored[0] : null;
  return (
    <aside
      aria-label="What to read next"
      className="mt-14 max-w-[66ch] border-l-2 border-indigo pl-4 font-sans sm:pl-5"
    >
      <p className="text-ui font-semibold text-ink">You have the outline.</p>
      {best ? (
        <>
          <p className="mt-1 text-note text-ink-2">
            Read in full the part where your guess was furthest off: Part {best.i + 1},{" "}
            {chapterTitle(best.c)}. You guessed {guessWords(best.g.answer, best.r)}; it was{" "}
            {answerWords(best.g.answer)}.
          </p>
          <button
            type="button"
            onClick={() => onRead(best.c)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-indigo px-3 py-1.5 text-sm font-medium text-paper hover:bg-indigo/90"
          >
            Read Part {best.i + 1} in full
          </button>
        </>
      ) : (
        <p className="mt-1 text-note text-ink-2">
          Pick the part that surprised you most and read it in full, with its sources.
        </p>
      )}
    </aside>
  );
}
