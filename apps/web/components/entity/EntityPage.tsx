"use client";

import { ENTITY_VIEW_PANELS, type ViewPanel } from "@pramana/core";
import { AddToCanvas } from "@/components/canvas/AddToCanvas";
import { AiChangeNotice, CustomiseButton } from "@/components/yourview/Customise";
import { useYourView } from "@/components/yourview/YourView";
import { AskAi } from "@/components/ai/AskAi";
import { LiveNotes } from "@/components/ai/LiveNotes";
import { dateBounds } from "@pramana/core";
import type { ClaimCard, EntityCard } from "@pramana/services";
import { ArrowUpRight, BookOpen, MapPin } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EntityPageData } from "@/app/e/[slug]/load";
import { Atlas } from "@/components/atlas/Atlas";
import { AtlasProvider, useAtlasBus } from "@/components/atlas/bus";
import { EntityChip } from "@/components/chips/Chips";
import { claimElement, isLocated, ReaderContext, type Reader } from "@/components/chips/reader";
import { ClaimItem } from "@/components/era/ClaimItem";
import { Panel, PlaceCard } from "@/components/era/ContextRail";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { Markdown } from "@/components/Markdown";
import {
  CommonsImage,
  EntityThumb,
  Gallery,
  ImaginingTag,
  MediaTile,
  ZoomButton,
  type ViewerMedia,
} from "@/components/media";
import { Disclosure } from "@/components/pages/Disclosure";
import { ERA_GRID, Frame } from "@/components/shell/Frame";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { datedLabel, durationWords, eraSpan, yearOf, yearsAgo } from "@/lib/era";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { SpanRows, type SpanRow } from "./SpanRows";
import { CERTAINTY_SENTENCE, groupLinks, KIND_SENTENCE, SPAN_ROLE } from "./words";

const LIVED_KINDS = new Set(["person"]);
/** On a phone, how many claims each page's group shows before "n more". */
const PHONE_FIRST = 3;

/**
 * A person, place, state or idea: who or what, when and where, then what the
 * evidence says, grouped by the chapter it is read in. The atlas and a
 * context card sit in a sticky rail, as on the era pages: claims open their
 * evidence there, places open their card and are framed on the map.
 */
export function EntityPage({
  data,
  history,
  ageLine,
}: {
  data: EntityPageData;
  history: React.ReactNode;
  /** The age line (components/time/AgeLine, rendered by the route): where this subject sits among the ages. */
  ageLine?: React.ReactNode;
}) {
  const body = <EntityReader data={data} history={history} ageLine={ageLine} />;
  if (!data.atlas) return body;
  return <AtlasProvider initialYear={data.atlas.initialYear}>{body}</AtlasProvider>;
}

function EntityReader({ data, history, ageLine }: { data: EntityPageData; history: React.ReactNode; ageLine?: React.ReactNode }) {
  const { detail, atlas, groups, appearsIn, belongedTo, nearby, media, mainPage, gloss } = data;
  const { entity, links, claims } = detail;
  const yv = useYourView();
  const hides = (panel: ViewPanel) => Boolean(yv?.hides(panel));
  const desktop = useMediaQuery("(min-width: 1024px)");
  const bus = useAtlasBus();
  const [selected, setSelected] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const atlasRef = useRef<HTMLDivElement>(null);

  const claimById = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims]);
  const cards = useMemo(() => {
    const m = new Map<string, EntityCard>([[entity.id, entity]]);
    for (const l of links) if (l.other) m.set(l.other.id, l.other);
    for (const n of nearby) m.set(n.entity.id, n.entity);
    return m;
  }, [entity, links, nearby]);
  const order = useMemo(() => groups.flatMap((g) => g.claimIds), [groups]);
  // The page the subject is chiefly read on: its own page, else the page whose "Names you'll meet"
  // introduces it, else the page with most of its claims.
  const homePage = useMemo(() => {
    if (mainPage) return mainPage.slug;
    if (gloss) return gloss.page.slug;
    const counts = new Map<string, number>();
    for (const g of groups) if (g.page) counts.set(g.page.slug, (counts.get(g.page.slug) ?? 0) + g.claimIds.length);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [mainPage, gloss, groups]);
  // Claims on that page first, then those about the subject before those that only mention it;
  // within each, the order of the subject's life: by date, an undated claim staying just after
  // the dated one before it in reading order. Each row names the page and part it is read in.
  const claimRows = useMemo(() => {
    let last = -Infinity;
    const rows = groups.flatMap((g) =>
      g.claimIds.map((id) => {
        const c = claimById.get(id);
        let start: number | null = null;
        try {
          start = c?.when ? dateBounds(c.when).startMin : null;
        } catch {
          start = null;
        }
        if (start !== null) last = start;
        return { id, g, key: start ?? last };
      }),
    );
    const ROLE_RANK: Record<string, number> = { subject: 0, participant: 1, author: 1, place: 1, mention: 2 };
    const roleRank = (id: string) =>
      Math.min(
        3,
        ...(claimById.get(id)?.entities ?? []).filter((e) => e.id === entity.id).map((e) => ROLE_RANK[e.role] ?? 2),
      );
    const pageRank = (r: (typeof rows)[number]) => (homePage && r.g.page?.slug === homePage ? 0 : 1);
    return rows
      .map((r, seq) => ({ ...r, seq, page: pageRank(r), role: roleRank(r.id) }))
      .sort(
        (a, b) =>
          a.page - b.page || a.role - b.role || (a.key === b.key ? 0 : a.key - b.key) || a.seq - b.seq,
      );
  }, [groups, claimById, homePage, entity.id]);
  const listOrder = useMemo(() => claimRows.map((r) => r.id), [claimRows]);
  // How sure we are, overall: from the claims' sources and assessments, never typed. The doubtful
  // ones (in the order of the list) are kept apart, so the line can open the first of them.
  const evidence = useMemo(() => {
    if (!claims.length) return null;
    const fromTime = claims.filter((c) =>
      c.citations.some((x) => x.stance !== "mentions" && x.excerpt.source.tier === "primary"),
    ).length;
    const found = claims.filter((c) => c.level >= 2).length;
    const doubtful = listOrder.filter((id) =>
      ["contested", "weak", "refuted"].includes(claimById.get(id)?.assessment ?? ""),
    );
    const n = claims.length;
    const line = [
      `${n} ${n === 1 ? "claim" : "claims"}`,
      fromTime ? `${fromTime === n ? "all" : fromTime} from sources of the time` : "",
      found === n
        ? "every quote found in its source"
        : `${found} with the quote found in its source`,
    ]
      .filter(Boolean)
      .join(", ")
      .replace(/^([^,]+), /, "$1: ");
    return { line, doubtful };
  }, [claims, listOrder, claimById]);

  const within = useMemo<[number, number] | null>(() => {
    const b = entity.bounds;
    return b?.startMin != null && b.endMax != null ? [b.startMin, b.endMax] : (atlas?.span ?? null);
  }, [entity.bounds, atlas?.span]);

  const [mapMovedTo, setMapMovedTo] = useState<number | null>(null);
  const select = useCallback(
    (id: string) => {
      if (selected === id) {
        setSelected(null);
        history_(null);
        return;
      }
      // Remember what opened the evidence, so closing it puts focus back there.
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body)
        opener.current = document.activeElement;
      setSelected(id);
      history_(id);
      // A dated claim shows the map in its year, and the evidence panel says so.
      const when = claimById.get(id)?.when;
      let moved: number | null = null;
      if (when && atlas) {
        const y = yearOf(dateBounds(when));
        if (y !== null) {
          bus.setYear(y, { fromReader: true });
          moved = y;
        }
      }
      setMapMovedTo(moved);
    },
    [selected, claimById, atlas, bus],
  );
  const close = useCallback(() => {
    setSelected(null);
    history_(null);
    const back = opener.current;
    if (back?.isConnected) requestAnimationFrame(() => back.focus({ preventScroll: true }));
  }, []);
  const selectEntity = useCallback((id: string) => {
    setSelected(null);
    setSelectedEntity((cur) => (cur === id ? null : id));
  }, []);

  // Claims are linkable here too: /e/slug#claim-<id>.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    const m = /^#claim-(.+)$/.exec(window.location.hash);
    if (m && claimById.has(m[1]!)) select(m[1]!);
    else {
      const pinned = new URLSearchParams(window.location.search).get("pin");
      const e = pinned
        ? [...cards.values()].find((c) => c.slug === pinned || c.id === pinned)
        : undefined;
      if (e && e.id !== entity.id) setSelectedEntity(e.id);
    }
  }, [claimById, select, cards, entity.id]);

  // The atlas pin follows the selection; with nothing selected, a place stays pinned on itself.
  const { pin, clearPin } = bus;
  const hadPin = useRef(false);
  const defaultPin = atlas?.pin ?? [];
  const defaultKey = defaultPin.join(",");
  useEffect(() => {
    const claim = selected ? claimById.get(selected) : undefined;
    const ids = claim
      ? claim.entities
          .filter((e) => cards.get(e.id)?.geo || atlas?.places.some((p) => p.id === e.id))
          .map((e) => e.id)
      : selectedEntity
        ? [selectedEntity]
        : defaultPin;
    if (ids.length) pin([...new Set(ids)], { toggle: false });
    else if (hadPin.current) clearPin();
    hadPin.current = ids.length > 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedEntity, claimById, cards, pin, clearPin, defaultKey]);

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

  const showYear = useCallback(
    (y: number) => {
      bus.setYear(y, { fromReader: true });
    },
    [bus, desktop],
  );

  const reader: Reader = useMemo(
    () => ({
      selectClaim: select,
      selectedClaim: selected,
      claimText: (id) => claimById.get(id)?.text,
      entity: (ref) => cards.get(ref),
      within,
      selectEntity,
      selectedEntity,
      showYear: atlas ? showYear : undefined,
    }),
    [select, selected, claimById, cards, within, selectEntity, selectedEntity, atlas, showYear],
  );

  const selectedClaim = selected ? claimById.get(selected) : undefined;
  const step = useCallback(
    (delta: 1 | -1) => {
      if (!selected) return;
      const i = listOrder.indexOf(selected);
      const next = listOrder[(i + delta + listOrder.length) % listOrder.length];
      if (next) {
        select(next);
        claimElement(next)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    },
    [selected, listOrder, select],
  );
  const drawer = selectedClaim ? (
    <EvidenceDrawer
      claim={selectedClaim}
      mapYear={mapMovedTo}
      people={selectedClaim.entities.flatMap((e) => cards.get(e.id) ?? [])}
      position={
        listOrder.includes(selectedClaim.id)
          ? {
              index: listOrder.indexOf(selectedClaim.id),
              total: listOrder.length,
              chapter: `What the evidence says about ${entity.label}`,
            }
          : null
      }
      onClose={close}
      focusOnOpen={desktop}
      onStep={listOrder.length > 1 ? step : undefined}
    />
  ) : null;
  const picked = selectedEntity ? cards.get(selectedEntity) : undefined;
  const placeCard = (onPhone: boolean) =>
    picked ? (
      <PlaceCard
        entity={picked}
        claims={order
          .map((id) => claimById.get(id))
          .filter((c): c is ClaimCard => Boolean(c?.entities.some((e) => e.id === picked.id)))}
        onSelectClaim={select}
        onClose={onPhone ? undefined : () => setSelectedEntity(null)}
        showMap={onPhone}
      />
    ) : null;

  const deva = entity.aliases.find((a) => a.script === "Deva");
  const ago = yearsAgo(entity.bounds);
  const years = durationWords(entity.bounds);
  const linkGroups = groupLinks(links);
  const otherPages = appearsIn.filter((p) => p.slug !== mainPage?.slug);
  const located = isLocated(entity) && entity.geo;
  // Say where a place is once. A place with a page's own line shows that line, not its description
  // as well (the two say the same, "the Maurya capital, at Patna"); and the location line drops its
  // note when the header already names every place in it.
  const showDescription = Boolean(entity.description) && !(gloss && located);
  const headerText = `${showDescription ? entity.description : ""} ${gloss?.text ?? ""}`;
  const noteNames = entity.geo?.note?.match(/(?<=\s)[A-ZĀĪŪṚṬḌṆŚṢ][\p{L}-]+/gu) ?? [];
  const showGeoNote = Boolean(entity.geo?.note) && !(noteNames.length > 0 && noteNames.every((n) => headerText.includes(n)));

  const lifeRows = useMemo(() => spanRowsFor(entity, links), [entity, links]);
  const placeRows: SpanRow[] = belongedTo.map((b) => ({
    key: b.key,
    label: b.slug ? (
      <Link href={`/e/${b.slug}`} className="text-ink no-underline hover:underline">
        {b.name}
      </Link>
    ) : (
      <span className="text-ink-2">{b.name}</span>
    ),
    dates: b.stretches.length === 1 ? b.stretches[0]!.label : eraSpan(b.from, b.to),
    from: b.from,
    to: b.to,
    stretches: b.stretches,
    tone: "place",
    year: Math.floor((b.stretches[0]!.from + b.stretches[0]!.to) / 2),
    pointAt: b.entityId ? [b.entityId] : undefined,
  }));

  // The five holders a reader is most likely to know (states with their own page or entry, then the longest), in order of time.
  const keyHolders = useMemo(() => {
    const ranked = [...belongedTo].sort(
      (a, b) =>
        Number(Boolean(b.slug)) - Number(Boolean(a.slug)) || b.to - b.from - (a.to - a.from),
    );
    const keep = new Set(ranked.slice(0, 5).map((b) => b.key));
    return placeRows.filter((r) => keep.has(r.key));
  }, [belongedTo, placeRows]);

  const namesCard = (entity.aliases.length > 0 || entity.wikidataId) && (
    <Panel title="Names">
      {entity.aliases.length > 0 && (
        <>
          <AliasList aliases={entity.aliases.slice(0, 5)} languages={data.aliasLanguages} />
          {entity.aliases.length > 5 && (
            <Disclosure
              summary={`${entity.aliases.length - 5} more names`}
              className="mt-2"
              triggerClassName="text-sm"
            >
              <AliasList
                aliases={entity.aliases.slice(5)}
                languages={data.aliasLanguages.slice(5)}
              />
            </Disclosure>
          )}
        </>
      )}
      {entity.wikidataId && (
        <p
          className={cn(
            "font-sans text-sm leading-snug text-ink-3",
            entity.aliases.length > 0 && "mt-4 border-t border-rule-soft pt-3",
          )}
        >
          The same {entity.kind === "person" ? "person" : "thing"} in{" "}
          <a
            href={`https://www.wikidata.org/wiki/${entity.wikidataId}`}
            className="text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo"
            target="_blank"
            rel="noreferrer"
          >
            Wikidata, {entity.wikidataId}
            <ArrowUpRight className="ml-0.5 inline size-3" aria-hidden />
          </a>
          . It fixes which {entity.label} we mean; it is not evidence.
        </p>
      )}
    </Panel>
  );

  // The rail's pictures: the entity's own, then those of the sites, inscriptions and places it is
  // linked to or near (only pictures already attached), never the portrait in the head twice.
  const railPictures = useMemo(() => {
    const seen = new Set<string>(entity.image ? [entity.image.mediaId] : []);
    const out: { key: string; media: ViewerMedia; title?: string }[] = [];
    const add = (key: string, m: ViewerMedia, title?: string) => {
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ key, media: m, title });
    };
    media.forEach((m) => add(m.id, m));
    const near = ["site", "inscription", "place", "event"];
    for (const e of [...links.map((l) => l.other), ...nearby.map((n) => n.entity)])
      if (e?.image && near.includes(e.kind)) add(e.image.mediaId, e.image, e.label);
    data.partPictures.forEach((p) => add(p.key, p.media, p.title));
    return out.slice(0, 9);
  }, [entity.image, media, links, nearby, data.partPictures]);
  const picturesCard = railPictures.length > 0 && (
    <Panel title="Pictures" className="mb-3">
      <ul className="grid grid-cols-3 gap-2">
        {railPictures.map((p) => (
          <li key={p.key} className="aspect-square min-w-0">
            <MediaTile media={p.media} title={p.title} fit="cover" />
          </li>
        ))}
      </ul>
    </Panel>
  );

  const contextCard = drawer ? (
    <div className="floating p-4">{drawer}</div>
  ) : picked ? (
    <div className="floating p-4">{placeCard(false)}</div>
  ) : (
    namesCard || (
      <Panel>
        <p className="font-sans text-note text-ink-3">
          Select a claim to see its sources here, or a place to find it on the map.
        </p>
      </Panel>
    )
  );
  const cardKey = selectedClaim ? `c:${selectedClaim.id}` : picked ? `e:${picked.id}` : "default";

  // Phones (below 768px): the claim list grouped by page, in the order above, each group showing
  // its first PHONE_FIRST claims and "n more". Desktop shows the whole list as one.
  const narrow = !useMediaQuery("(min-width: 768px)");
  const phoneGroups = useMemo(() => {
    const out: { key: string; slug: string | null; title: string; rows: typeof claimRows }[] = [];
    for (const r of claimRows) {
      const key = r.g.page?.slug ?? "none";
      let grp = out.find((x) => x.key === key);
      if (!grp) out.push((grp = { key, slug: r.g.page?.slug ?? null, title: r.g.page?.title ?? "Not on a page yet", rows: [] }));
      grp.rows.push(r);
    }
    return out;
  }, [claimRows]);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  /** One claim row, under the page and part it is read in (`withPage`), or only the part (inside a page's group). */
  const claimRow = (id: string, g: (typeof claimRows)[number]["g"], withPage: boolean) => (
    <li key={id} className="py-3">
      <p className="font-sans text-sm text-ink-3">
        {g.page ? (
          <Link
            href={`/p/${g.page.slug}${g.chapter ? `#${g.chapter.id}` : ""}`}
            className="text-ink-2 no-underline hover:text-indigo hover:underline"
          >
            {withPage && g.page.title}
            {g.chapter && (
              <span className="tnum">
                {withPage ? ", " : ""}Part {g.chapter.index + 1}: {g.chapter.title}
              </span>
            )}
          </Link>
        ) : (
          "Not on a page yet"
        )}
      </p>
      <ul className="-ml-4">
        <ClaimItem claim={claimById.get(id)} selected={selected === id} onSelect={select} cue />
      </ul>
    </li>
  );

  // The atlas's years are the subject's own (a state, a reign) or only the stretch it shows (a place read in an age).
  const spanIsOwn = Boolean(
    atlas?.span &&
      entity.bounds?.startMin != null &&
      entity.bounds.endMax != null &&
      Math.abs(atlas.span[0] - entity.bounds.startMin) <= 1 &&
      Math.abs(atlas.span[1] - entity.bounds.endMax) <= 1,
  );
  const atlasNode = (variant: "rail" | "inline", height?: number) =>
    atlas ? (
      <Atlas
        title={entity.label}
        spanIsOwn={spanIsOwn}
        spec={atlas.spec}
        focusEntityId={["polity", "period", "culture"].includes(entity.kind) ? entity.id : null}
        span={atlas.span}
        places={atlas.places}
        timeline={data.timeline}
        pageByEntity={data.pageByEntity}
        variant={variant}
        mapHeight={height}
        onSelectEntity={selectEntity}
        collapsed={variant === "rail" && Boolean(selectedClaim || picked)}
      />
    ) : null;

  return (
    <ReaderContext.Provider value={reader}>
      <Frame className={cn(ERA_GRID({ outline: false, rail: true }), "pt-6 pb-4 sm:pt-8 lg:pt-10")}>
        {/* ------------------------------------------------ who or what, when, where */}
        <header className="era-hero min-w-0">
          {/* The line is time (docs/visual.md §1): every age, the one this subject belongs to lit, its dates as the cursor. */}
          {ageLine && <div className="mb-5">{ageLine}</div>}
          {/* Below 400px the picture goes under the title, so the name and dates keep the full width. */}
          <div className="flex flex-col gap-4 min-[400px]:flex-row min-[400px]:items-start min-[400px]:gap-6">
            <div className="min-w-0 flex-1">
              <p className="font-sans text-ui text-ink-2">
                {KIND_SENTENCE[entity.kind] ?? entity.kind}
              </p>
              <h1 className="mt-2 text-4xl tracking-[-0.02em] text-ink">
                {entity.label}
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
              {entity.whenLabel && (
                <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {/* A place's date is when it was founded, not what it is: said smaller, as a fact about it. */}
                  <span
                    className={cn(
                      "text-ink tnum",
                      isLocated(entity) && entity.kind !== "event"
                        ? "font-sans text-ui text-ink-2 first-letter:uppercase"
                        : "font-serif text-xl sm:text-2xl",
                    )}
                  >
                    {datedLabel(entity)}
                  </span>
                  {(ago || years) && (
                    <span className="font-sans text-ui text-ink-2">
                      {ago}
                      {ago && years ? ", " : ""}
                      {years ? `for ${years}` : ""}
                    </span>
                  )}
                </div>
              )}
              {/* Answer first: why it matters, then how sure we are. Why it matters is a page's own line
                  ("Names you'll meet"); without one, the subject's description says what it is. */}
              {showDescription && (
                <p
                  className={cn(
                    "max-w-[60ch]",
                    gloss ? "mt-4 font-sans text-ui text-ink-2" : "mt-5 text-lg leading-relaxed text-ink",
                  )}
                >
                  {entity.description}
                </p>
              )}
              {gloss && (
                <div className="mt-3 max-w-[60ch]">
                  <Markdown className="text-lg leading-relaxed text-ink">{gloss.text}</Markdown>
                  <Link
                    href={`/p/${gloss.page.slug}${gloss.target ? `#${gloss.target}` : ""}`}
                    className="mt-1 inline-block font-sans text-xs text-ink-3 underline decoration-rule underline-offset-3 hover:text-indigo hover:decoration-indigo"
                  >
                    From {gloss.page.title}
                  </Link>
                </div>
              )}
              {evidence && (
                <p className="mt-2 font-sans text-ui text-ink-2 tnum">
                  {evidence.line}
                  {evidence.doubtful.length > 0 && (
                    <>
                      {", "}
                      <a
                        href={`#claim-${evidence.doubtful[0]}`}
                        onClick={(e) => {
                          e.preventDefault();
                          const id = evidence.doubtful[0]!;
                          if (selected !== id) select(id);
                          // After the render that shows it (on a phone it may sit in a folded group).
                          requestAnimationFrame(() =>
                            claimElement(id)?.scrollIntoView({ block: "center", behavior: "smooth" }),
                          );
                        }}
                        aria-label={
                          evidence.doubtful.length === 1
                            ? "1 contested or weakly supported: open that claim"
                            : `${evidence.doubtful.length} contested or weakly supported: open the first`
                        }
                        className="text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo"
                      >
                        {evidence.doubtful.length} contested or weakly supported
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
            {entity.image && (
              <figure className="flex shrink-0 items-end gap-3 min-[400px]:block">
                <EntityThumb image={entity.image} size={desktop ? 200 : 96} />
                <figcaption className="max-w-[16rem] font-sans text-xs leading-snug text-ink-3 min-[400px]:mt-1.5 min-[400px]:w-24 lg:w-[200px]">
                  {entity.image.representationLabel}
                </figcaption>
              </figure>
            )}
          </div>

          <AskAi
            subject={{ type: "entity", entity: entity.slug, label: entity.label }}
            className="mt-4"
          />
          <LiveNotes subject={{ type: "entity", id: entity.id }} className="mt-8 max-w-[60ch]" />

          {located && entity.geo && (
            <p className="mt-4 flex max-w-[60ch] items-start gap-2 font-sans text-note text-ink-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-sandstone" aria-hidden />
              <span>
                {CERTAINTY_SENTENCE[entity.geo.certainty]}
                {showGeoNote ? ` ${entity.geo.note}` : ""}
              </span>
            </p>
          )}

          <AiChangeNotice className="mt-4" />
          <div className="mt-5 flex flex-wrap items-center gap-1">
            <CustomiseButton
              panels={ENTITY_VIEW_PANELS.filter((p) => p !== "atlas" || Boolean(atlas))}
            />
            <AddToCanvas content={{ kind: "entity", entity: entity.id }} what={entity.label} />
          </div>

          {mainPage && (
            <Link
              href={`/p/${mainPage.slug}`}
              className="tile group mt-7 flex max-w-[44rem] items-center gap-4 px-5 py-4"
            >
              <BookOpen className="size-5 shrink-0 text-indigo" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-sans text-ui font-semibold text-indigo group-hover:underline">
                  Read the page: {mainPage.title}
                </span>
                {mainPage.summary && (
                  <span className="mt-0.5 line-clamp-2 block font-sans text-note text-ink-2">
                    {mainPage.summary}
                  </span>
                )}
              </span>
            </Link>
          )}

          {/* Phones: the atlas right under the orientation, before the details. */}
          {!desktop && atlas && (
            <div ref={atlasRef} className="mt-7 scroll-mt-[calc(var(--topbar-h)+1rem)]">
              {atlasNode("inline", 240)}
            </div>
          )}

          {lifeRows.length > 0 && (
            <section className="mt-8 max-w-[44rem]" aria-labelledby="when-h">
              <h2 id="when-h" className="mb-2 font-sans text-ui font-semibold text-ink">
                {LIVED_KINDS.has(entity.kind) ? "Life and reign" : "When"}
              </h2>
              <SpanRows
                rows={lifeRows}
                label={`${entity.label} in time`}
                onYear={atlas ? showYear : undefined}
              />
              {(entity.when?.basis || entity.spans?.some((s) => s.basis)) && (
                <Disclosure
                  summary="How these dates were set"
                  className="mt-2"
                  triggerClassName="text-sm"
                >
                  <ul className="space-y-1.5 font-sans text-sm leading-snug text-ink-2">
                    {entity.when?.basis && <li>{entity.when.basis}</li>}
                    {entity.spans
                      ?.filter((s) => s.basis)
                      .map((s, i) => (
                        <li key={i}>
                          <span className="text-ink">{SPAN_ROLE[s.role] ?? s.role}:</span> {s.basis}
                        </li>
                      ))}
                  </ul>
                </Disclosure>
              )}
            </section>
          )}

          {placeRows.length > 0 && (
            <section className="mt-8 max-w-[44rem]" aria-labelledby="held-h">
              <h2 id="held-h" className="font-sans text-ui font-semibold text-ink">
                Whose land it was
              </h2>
              <p className="mb-2 font-sans text-sm text-ink-3">
                States whose reconstructed borders contain this point, after Cliopatria (Seshat), CC
                BY 4.0.{atlas ? " Pick the years to see that map." : ""}
              </p>
              <SpanRows
                rows={keyHolders}
                label={`States that held ${entity.label}`}
                onYear={atlas ? showYear : undefined}
              />
              {placeRows.length > keyHolders.length && (
                <Disclosure
                  summary={`Show all ${placeRows.length} states`}
                  className="mt-2"
                  triggerClassName="text-sm"
                >
                  <SpanRows
                    rows={placeRows}
                    label={`Every state that held ${entity.label}`}
                    onYear={atlas ? showYear : undefined}
                  />
                </Disclosure>
              )}
            </section>
          )}
        </header>

        {/* ------------------------------------------------ the evidence, connections, pages */}
        <div className="era-body min-w-0 space-y-12">
          <section hidden={hides("claims")} aria-labelledby="claims-h">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h2 id="claims-h" className="text-2xl text-ink">
                {located && entity.kind !== "event"
                  ? "What happened here"
                  : `What the evidence says about ${entity.label}`}
              </h2>
              {claims.length > 0 && (
                <span className="font-sans text-sm text-ink-3 tnum">
                  {claims.length} {claims.length === 1 ? "claim" : "claims"}
                </span>
              )}
            </div>
            {claimRows.length && narrow ? (
              // Phones: the claims grouped by page, in the list's order, each group folded to its first few.
              <div className="mt-4 space-y-6">
                {phoneGroups.map((grp) => {
                  const open = openGroups.has(grp.key);
                  const shown = grp.rows.filter((r, i) => open || i < PHONE_FIRST || r.id === selected);
                  const more = grp.rows.length - shown.length;
                  return (
                    <section key={grp.key} aria-label={grp.title}>
                      <h3 className="font-sans text-ui font-semibold text-ink">
                        {grp.slug ? (
                          <Link href={`/p/${grp.slug}`} className="no-underline hover:text-indigo hover:underline">
                            {grp.title}
                          </Link>
                        ) : (
                          grp.title
                        )}{" "}
                        <span className="font-normal text-ink-3 tnum">{grp.rows.length}</span>
                      </h3>
                      <ul className="mt-2 divide-y divide-rule border-y border-rule">
                        {shown.map(({ id, g }) => claimRow(id, g, false))}
                      </ul>
                      {(more > 0 || open) && grp.rows.length > PHONE_FIRST && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 -ml-2 text-indigo"
                          aria-expanded={open}
                          onClick={() =>
                            setOpenGroups((cur) => {
                              const next = new Set(cur);
                              if (open) next.delete(grp.key);
                              else next.add(grp.key);
                              return next;
                            })
                          }
                        >
                          {open ? "Show fewer" : `${more} more from ${grp.title}`}
                        </Button>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : claimRows.length ? (
              <ul className="mt-4 divide-y divide-rule border-y border-rule">
                {claimRows.map(({ id, g }) => claimRow(id, g, true))}
              </ul>
            ) : (
              <EmptyState
                className="mt-4"
                title={`No claims about ${entity.label} yet`}
                action={
                  <AskAi
                    subject={{ type: "entity", entity: entity.slug, label: entity.label }}
                    label="Ask your AI to propose some"
                  />
                }
              >
                Proposed claims, with their sources, appear here once they are reviewed.
              </EmptyState>
            )}
          </section>

          {/* From 1024px the pictures are in the rail. */}
          {media.length > 0 && (
            <section aria-labelledby="pictures-h" className="lg:hidden">
              <h2 id="pictures-h" className="text-2xl text-ink">
                Pictures
              </h2>
              <Gallery items={media.map((m) => ({ media: m }))} className="mt-4" />
            </section>
          )}

          {linkGroups.length > 0 && (
            <section hidden={hides("links")} aria-labelledby="links-h">
              <h2 id="links-h" className="text-2xl text-ink">
                Connections
              </h2>
              <dl className="mt-4 divide-y divide-rule border-y border-rule font-sans">
                {linkGroups.map(([phrase, items]) => (
                  <div key={phrase} className="grid gap-x-6 gap-y-2 py-3 sm:grid-cols-[9rem_1fr]">
                    <dt className="pt-1 text-ui text-ink-3">{phrase}</dt>
                    <dd className="flex flex-wrap gap-x-4 gap-y-2">
                      {items.map((l) => (
                        <span key={l.id} className="inline-flex items-center gap-2">
                          <EntityChip entity={l.other} within={within} />
                          {datedLabel(l.other) && (
                            <span className="text-sm text-ink-3 tnum">{datedLabel(l.other)}</span>
                          )}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {nearby.length > 0 && (
            <section hidden={hides("nearby")} aria-labelledby="near-h">
              <h2 id="near-h" className="text-2xl text-ink">
                Nearby
              </h2>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 font-sans">
                {nearby.map((n) => (
                  <li key={n.entity.id} className="inline-flex items-center gap-2">
                    <EntityChip entity={n.entity} />
                    <span className="text-sm text-ink-3 tnum">
                      about {n.km.toLocaleString("en-GB")} km
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {otherPages.length > 0 && (
            <section hidden={hides("pages")} aria-labelledby="pages-h">
              <h2 id="pages-h" className="text-2xl text-ink">
                Appears in
              </h2>
              <ul className="mt-4 grid gap-x-8 gap-y-10 md:grid-cols-2">
                {otherPages.map((p) => (
                  <li key={p.slug} className="relative">
                    {p.lead && (
                      <Link
                        href={`/p/${p.slug}`}
                        className="relative block aspect-[16/6] overflow-hidden rounded-md bg-field"
                        tabIndex={-1}
                        aria-hidden
                      >
                        <CommonsImage
                          file={p.lead}
                          fill
                          decorative
                          sizes="(min-width: 768px) 30rem, 100vw"
                        />
                        <ImaginingTag
                          representation={p.lead.representation}
                          className="absolute top-2 left-2"
                        />
                      </Link>
                    )}
                    {/* Beside the link, never inside it: the picture opens larger without leaving. */}
                    {p.lead && <ZoomButton media={p.lead} className="absolute top-2 right-2" />}
                    <div className="pt-3">
                      <Link
                        href={`/p/${p.slug}`}
                        className="text-xl text-ink no-underline hover:text-indigo"
                      >
                        {p.title}
                      </Link>
                      {p.summary && (
                        <p className="mt-1 line-clamp-2 font-sans text-note text-ink-2">
                          {p.summary}
                        </p>
                      )}
                      {p.chapters.length > 0 && (
                        <ul className="mt-3 space-y-1 font-sans text-sm">
                          {p.chapters.map((c) => (
                            <li key={c.id}>
                              <Link
                                href={`/p/${p.slug}#${c.id}`}
                                className="text-indigo no-underline hover:underline"
                              >
                                <span className="text-ink-3 tnum">Part {c.index + 1}.</span>{" "}
                                {c.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Phones: names and identity, below the evidence. */}
          {!desktop && namesCard}

          <section hidden={hides("history")} aria-label="Record of changes">
            <Disclosure
              summary={`Show the record of changes to ${entity.label}`}
              className="border-t border-rule pt-2"
            >
              {history}
            </Disclosure>
          </section>
        </div>
        {/* ------------------------------------------------ the rail: atlas and context card */}
        <aside className="era-rail hidden min-w-0 lg:block" aria-label="Map and context">
          <div
            className={cn(
              "sticky top-[calc(var(--topbar-h)+1rem)] flex max-h-[calc(100dvh-var(--topbar-h)-2rem)] flex-col gap-3",
            )}
          >
            {desktop && atlas && !hides("atlas") && (
              <div className="shrink-0">{atlasNode("rail", 260)}</div>
            )}
            <div className="scroll-thin -mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-8 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.75rem),transparent)]">
              {!drawer && !picked && picturesCard}
              <div
                key={cardKey}
                className="animate-in fade-in duration-200 ease-[var(--ease-out-quart)]"
              >
                {contextCard}
              </div>
            </div>
          </div>
        </aside>
      </Frame>

      {!desktop && (
        <Drawer
          open={Boolean(selectedClaim || picked)}
          onOpenChange={(o) => !o && (close(), setSelectedEntity(null))}
          showSwipeHandle
        >
          <DrawerContent
            aria-modal="true"
            finalFocus={opener}
            className="max-h-[88dvh] px-4 pb-[calc(1.5rem+var(--safe-bottom))]"
          >
            <DrawerTitle className="sr-only">
              {selectedClaim ? "Evidence" : (picked?.label ?? "Details")}
            </DrawerTitle>
            <div className="scroll-thin overflow-y-auto">{drawer ?? placeCard(true)}</div>
          </DrawerContent>
        </Drawer>
      )}
    </ReaderContext.Provider>
  );
}

function AliasList({
  aliases,
  languages,
}: {
  aliases: EntityCard["aliases"];
  languages: (string | null)[];
}) {
  return (
    <ul className="space-y-2 font-sans">
      {aliases.map((a, i) => (
        <li key={i}>
          <span className="font-serif text-base text-ink" lang={a.lang}>
            {a.label}
          </span>
          {(languages[i] || a.note) && (
            <span className="block text-sm leading-snug text-ink-3">
              {languages[i]}
              {languages[i] && a.note ? ". " : ""}
              {a.note}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function history_(claimId: string | null) {
  history.replaceState(null, "", claimId ? `#claim-${claimId}` : window.location.pathname);
}

/** A person's reign, life and activity, with the states they ruled as faint context rows. */
function spanRowsFor(entity: EntityCard, links: EntityPageData["detail"]["links"]): SpanRow[] {
  const rows: SpanRow[] = [];
  const order = ["reign", "life", "floruit", "existence", "construction", "activity"];
  const spans = [...(entity.spans ?? [])].sort(
    (a, b) => order.indexOf(a.role) - order.indexOf(b.role),
  );
  for (const s of spans) {
    if (s.bounds.startMin === null) continue;
    rows.push({
      key: `${s.role}-${s.label}`,
      label: SPAN_ROLE[s.role] ?? s.role,
      dates: s.label.replace(/^(reigned|lived|born|died)\s+/i, ""),
      from: s.bounds.startMin,
      to: s.bounds.endMax ?? s.bounds.startMin + 1,
      approximate: s.bounds.approximate,
      year: yearOf(s.bounds) ?? undefined,
    });
  }
  if (
    !rows.length &&
    entity.bounds?.startMin != null &&
    (entity.bounds.endMax ?? entity.bounds.startMin) - entity.bounds.startMin > 1
  ) {
    rows.push({
      key: "when",
      label: SPAN_ROLE.existence!,
      dates: entity.whenLabel ?? "",
      from: entity.bounds.startMin,
      to: entity.bounds.endMax ?? entity.bounds.startMin + 1,
      approximate: entity.bounds.approximate,
    });
  }
  // A single year is already in the header; a bar for it says nothing.
  if (!rows.length || (rows.length === 1 && rows[0]!.to - rows[0]!.from <= 2)) return [];
  // Context: the states a ruler ruled, faint, so a reign reads against its empire.
  for (const l of links) {
    if (
      l.type !== "ruled" ||
      l.direction !== "out" ||
      !l.other?.bounds ||
      l.other.bounds.startMin === null
    )
      continue;
    rows.push({
      key: `ctx-${l.other.id}`,
      label: (
        <Link
          href={l.other.pageSlug ? `/p/${l.other.pageSlug}` : `/e/${l.other.slug}`}
          className="text-ink-2 no-underline hover:text-ink hover:underline"
        >
          {l.other.label}
        </Link>
      ),
      dates: l.other.whenLabel ?? "",
      from: l.other.bounds.startMin,
      to: l.other.bounds.endMax ?? l.other.bounds.startMin + 1,
      approximate: l.other.bounds.approximate,
      year: yearOf(l.other.bounds) ?? undefined,
      tone: "faint",
      pointAt: [l.other.id],
    });
  }
  return rows;
}
