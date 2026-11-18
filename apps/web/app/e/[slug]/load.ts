import {
  AtlasSpec,
  bboxOf,
  claimIdsInBlock,
  dateBounds,
  type AtlasSpec as AtlasSpecType,
} from "@pramana/core";
import { getDb } from "@pramana/db";
import {
  allDatedEntities,
  extentsContaining,
  extentsForEntity,
  getEntityDetail,
  getPageView,
  listEntities,
  listMedia,
  listPages,
  mapFeatures,
  NotFoundError,
  timelineItems,
  type EntityCard,
  type EntityDetail,
  type ExtentFeature,
  type MapFeature,
  type EntityImage,
  type MediaCard,
  type TimelineItem,
} from "@pramana/services";
import { notFound } from "next/navigation";
import { chapterContext, chapterTitle, eraSpan, layoutEra, peakYear, yearOf } from "@/lib/era";
import { languageName } from "@/components/entity/words";

/*
 * Everything an entity page shows, gathered on the server: the claims that
 * name it grouped by the page and chapter they are read in, the pages it
 * appears in, the atlas (whose borders, which places, which year), and for a
 * place, whose territory it lay in over time and what else is near.
 */

export const LOCATED = new Set(["place", "site", "inscription", "event"]);
const POLITY_KINDS = new Set(["polity", "period", "culture", "group"]);

export interface ClaimGroup {
  key: string;
  page: { slug: string; title: string } | null;
  chapter: { id: string; title: string; index: number } | null;
  claimIds: string[];
}

export interface AppearsIn {
  slug: string;
  title: string;
  summary: string | null;
  kind: string;
  /** Chapters where it is named, in reading order. */
  chapters: { id: string; title: string; index: number }[];
  claims: number;
  /** The page's lead image. */
  lead: MediaCard | null;
}

/** A polity whose territory held this place, over one or more stretches of years. */
export interface BelongedTo {
  key: string;
  name: string;
  entityId: string | null;
  slug: string | null;
  from: number;
  to: number;
  /** Separate stretches, when the place left and came back. */
  stretches: { from: number; to: number; label: string }[];
}

export interface Nearby {
  entity: EntityCard;
  km: number;
}

export interface EntityAtlas {
  spec: AtlasSpecType;
  span: [number, number] | null;
  places: MapFeature[];
  initialYear: number | null;
  /** Pinned when the page opens (the place itself). */
  pin: string[];
}

export interface EntityPageData {
  detail: EntityDetail;
  groups: ClaimGroup[];
  appearsIn: AppearsIn[];
  atlas: EntityAtlas | null;
  timeline: TimelineItem[];
  pageByEntity: Record<string, string>;
  belongedTo: BelongedTo[];
  nearby: Nearby[];
  media: MediaCard[];
  /**
   * Pictures from the parts that name it, already attached to them: the parts' figures, then their
   * sites' and inscriptions' pictures (for the rail's strip; the entity's own `media` come first there).
   */
  partPictures: { key: string; media: MediaCard | EntityImage; title: string }[];
  /** The language of each alias in words, aligned with entity.aliases (worked out here, not in the browser). */
  aliasLanguages: (string | null)[];
  /** The entity's own page, when it has one. */
  mainPage: { slug: string; title: string; summary: string | null } | null;
  /**
   * Why it matters, in a page's own words: its line in an era page's "Names
   * you'll meet" (its own page first). Null when no page has one; never written here.
   */
  gloss: { text: string; page: { slug: string; title: string }; target: string | null } | null;
}

export async function loadEntity(slug: string): Promise<EntityDetail> {
  try {
    return await getEntityDetail(decodeURIComponent(slug));
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

/** A representative point for a geometry: the point itself, else the middle of its bounding box. */
export function pointOf(geometry: unknown): [number, number] | null {
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g?.type === "Point" && Array.isArray(g.coordinates))
    return [Number(g.coordinates[0]), Number(g.coordinates[1])];
  if (g?.type === "Polygon" || g?.type === "MultiPolygon") {
    const b = bboxOf(g.coordinates as Parameters<typeof bboxOf>[0]);
    if (b) return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  }
  return null;
}

function km([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** The polities whose (reconstructed) borders contained a point, merged into stretches of years. */
async function belongedToAt(point: [number, number]): Promise<BelongedTo[]> {
  // Point-in-polygon over every border, once per point until the borders change (services).
  const rows = await extentsContaining(point).catch(() => []);
  const groups = new Map<string, BelongedTo>();
  for (const e of rows) {
    const key = e.entity?.id ?? `name:${e.name}`;
    const g = groups.get(key) ?? {
      key,
      name: e.entity?.label ?? e.name,
      entityId: e.entity?.id ?? null,
      slug: e.entity?.slug ?? null,
      from: e.fromYear,
      to: e.toYear,
      stretches: [],
    };
    const last = g.stretches.at(-1);
    if (last && e.fromYear <= last.to + 1) last.to = Math.max(last.to, e.toYear);
    else g.stretches.push({ from: e.fromYear, to: e.toYear, label: "" });
    g.from = Math.min(g.from, e.fromYear);
    g.to = Math.max(g.to, e.toYear);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      stretches: g.stretches.map((s) => ({ ...s, label: eraSpan(s.from, s.to) })),
    }))
    .sort((a, b) => a.from - b.from);
}

/** A span from bounds, padded a little so the ends are visible. */
function spanOf(
  bounds: { startMin: number | null; endMax: number | null } | null | undefined,
): [number, number] | null {
  if (!bounds || bounds.startMin === null) return null;
  const end = bounds.endMax ?? bounds.startMin + 1;
  return [Math.floor(bounds.startMin), Math.ceil(end)];
}

export async function loadEntityPage(detail: EntityDetail): Promise<EntityPageData> {
  const { entity, links, claims } = detail;
  const db = getDb();
  const [allPages, ages, lens, media] = await Promise.all([
    listPages(),
    allDatedEntities(["period", "polity", "culture"]),
    timelineItems(db, { linkedTo: entity.id }).catch(() => [] as TimelineItem[]),
    listMedia({ depicts: entity.id, limit: 8 }).catch(() => [] as MediaCard[]),
  ]);
  const pageByEntity: Record<string, string> = {};
  for (const p of allPages)
    if (p.entity && p.kind !== "overview") pageByEntity[p.entity.id] = p.slug;
  const summaryBySlug = new Map(allPages.map((p) => [p.slug, p]));

  // Claims grouped by where they are read: page, then chapter, in reading order.
  const claimSet = new Set(claims.map((c) => c.id));
  const placed = new Set<string>();
  const groups: ClaimGroup[] = [];
  const appearsIn: AppearsIn[] = [];
  const partPictures: EntityPageData["partPictures"] = [];
  const pictured = new Set<string>(entity.image ? [entity.image.mediaId] : []);
  const addPicture = (key: string, m: MediaCard | EntityImage, title: string) => {
    if (pictured.has(key) || partPictures.length >= 12) return;
    pictured.add(key);
    partPictures.push({ key, media: m, title });
  };
  // Every page is checked (there are few): a page names the entity in its claims, its chapters' casts, or its own subject.
  const pageRefs = [...allPages].sort(
    (a, b) =>
      Number(b.slug === entity.pageSlug) - Number(a.slug === entity.pageSlug) ||
      Number(a.kind === "overview") - Number(b.kind === "overview"),
  );
  const eras: { span: [number, number]; count: number; own: boolean; described: boolean }[] = [];
  let gloss: EntityPageData["gloss"] = null;
  for (const ref of pageRefs) {
    let view;
    try {
      view = await getPageView(ref.slug);
    } catch {
      continue;
    }
    const mentioned =
      view.page.entity?.id === entity.id ||
      detail.pages.some((p) => p.slug === ref.slug) ||
      Object.keys(view.claims).some((id) => claimSet.has(id)) ||
      Boolean(view.entities[entity.id]);
    if (!mentioned) continue;
    for (const b of view.page.blocks) {
      if (gloss || b.type !== "already_know") continue;
      const item = b.items.find(
        (i) => i.entity === entity.id || i.entity === entity.slug || view.entities[i.entity]?.id === entity.id,
      );
      if (item)
        gloss = { text: item.text, page: { slug: ref.slug, title: view.page.title }, target: item.target ?? null };
    }
    const layout = layoutEra(view.page.blocks, claimIdsInBlock);
    const chapters: AppearsIn["chapters"] = [];
    let count = 0;
    layout.chapters.forEach((c, index) => {
      const ids = c.claimIds.filter((id) => claimSet.has(id) && !placed.has(id));
      const ctx = chapterContext(view, c);
      const named =
        [...ctx.people, ...ctx.witnesses, ...ctx.places, ...ctx.terms].some(
          (e) => e.id === entity.id,
        ) || c.claimIds.some((id) => claimSet.has(id));
      if (named) {
        chapters.push({ id: c.id, title: chapterTitle(c), index });
        for (const b of c.blocks) {
          const items =
            b.type === "figure" ? [b.media] : b.type === "gallery" ? b.items.map((i) => i.media) : [];
          for (const id of items) {
            const m = view.media[id];
            if (m) addPicture(m.id, m, m.title);
          }
        }
        for (const p of ctx.places)
          if (p.image && p.id !== entity.id) addPicture(p.image.mediaId, p.image, p.label);
      }
      if (!ids.length) return;
      ids.forEach((id) => placed.add(id));
      count += ids.length;
      groups.push({
        key: `${ref.slug}#${c.id}`,
        page: { slug: ref.slug, title: view.page.title },
        chapter: { id: c.id, title: chapterTitle(c), index },
        claimIds: ids,
      });
    });
    // Claims on pages without chapters (the overview) go under the page.
    const rest = Object.keys(view.claims).filter((id) => claimSet.has(id) && !placed.has(id));
    if (rest.length) {
      rest.forEach((id) => placed.add(id));
      count += rest.length;
      groups.push({
        key: ref.slug,
        page: { slug: ref.slug, title: view.page.title },
        chapter: null,
        claimIds: rest,
      });
    }
    // The era a place or person is read in gives the atlas its years when they have no date of their own.
    const pb = view.page.entity?.bounds;
    // Candidate ages it is read in; the atlas opens on the first where it matters (below).
    if (view.page.kind === "era" && pb?.startMin != null && pb.endMax != null)
      eras.push({
        span: [Math.floor(pb.startMin), Math.ceil(pb.endMax)],
        count,
        own: view.page.entity?.id === entity.id,
        // The entity's own one-line description names the age it belongs to ("Capital of the Maurya Empire").
        described: Boolean(
          view.page.entity && entity.description?.includes(view.page.entity.label),
        ),
      });
    const summary = summaryBySlug.get(ref.slug);
    const leadId = view.page.spec.hero.media;
    appearsIn.push({
      slug: ref.slug,
      title: view.page.title,
      summary: summary?.summary ?? null,
      kind: summary?.kind ?? view.page.kind,
      chapters,
      claims: count,
      lead: leadId ? (view.media[leadId] ?? null) : null,
    });
  }
  // Its own era page, else the age its description names (Pāṭaliputra: "Capital of the Maurya
  // Empire"), else the earliest age where at least two claims name it, else the one naming it most.
  const byTime = [...eras].sort((a, b) => a.span[0] - b.span[0]);
  const contextSpan: [number, number] | null =
    (
      eras.find((e) => e.own) ??
      eras.find((e) => e.described) ??
      byTime.find((e) => e.count >= 2) ??
      [...eras].sort((a, b) => b.count - a.count)[0]
    )?.span ?? null;
  const unplaced = claims.filter((c) => !placed.has(c.id)).map((c) => c.id);
  if (unplaced.length)
    groups.push({ key: "unplaced", page: null, chapter: null, claimIds: unplaced });

  // The atlas: which places, whose borders, which years.
  const located = LOCATED.has(entity.kind) && entity.geo !== null;
  const linkedIds = links.map((l) => l.other?.id).filter((id): id is string => Boolean(id));
  const claimEntityIds = claims.flatMap((c) => c.entities.map((e) => e.id));
  const features = await mapFeatures(db, {
    entityIds: [entity.id, ...linkedIds, ...claimEntityIds],
  }).catch(() => [] as MapFeature[]);
  const places = features.filter((f) => LOCATED.has(f.kind));
  const point = located ? pointOf(entity.geo!.geometry) : null;
  const belongedTo = point ? await belongedToAt(point) : [];

  let atlas: EntityAtlas | null = null;
  if (entity.kind === "person") {
    const polities = links
      .filter(
        (l) =>
          l.other &&
          POLITY_KINDS.has(l.other.kind) &&
          (l.type === "ruled" || l.type === "member_of"),
      )
      .map((l) => l.other.id);
    const reign = entity.spans?.find((s) => s.role === "reign");
    const life = entity.spans?.find((s) => s.role === "life");
    const span = spanOf(reign?.bounds ?? life?.bounds ?? entity.bounds);
    if (places.length || polities.length) {
      atlas = {
        spec: AtlasSpec.parse({ focus: polities }),
        span,
        places,
        initialYear: yearOf(reign?.bounds ?? life?.bounds ?? entity.bounds),
        pin: [],
      };
    }
  } else if (POLITY_KINDS.has(entity.kind) && entity.kind !== "group") {
    const extents = await extentsForEntity(entity.id, { geometry: false }).catch(
      () => [] as ExtentFeature[],
    );
    if (extents.length || places.length) {
      atlas = {
        spec: AtlasSpec.parse({ focus: [entity.id] }),
        span: spanOf(entity.bounds),
        places,
        initialYear: peakYear(extents) ?? yearOf(entity.bounds),
        pin: [],
      };
    }
  } else if (located) {
    // A place opens on its own date, else on the years its claims are about, else on its first known polity.
    const datedClaims = claims
      .map((c) => c.when)
      .filter((w): w is NonNullable<typeof w> => Boolean(w));
    const claimBounds = claimSpan(datedClaims);
    const own = spanOf(entity.bounds);
    const span =
      entity.kind === "event"
        ? (own ?? claimBounds ?? contextSpan)
        : (contextSpan ?? own ?? claimBounds);
    const focus = belongedTo.flatMap((b) => (b.entityId ? [b.entityId] : [])).slice(0, 12);
    atlas = {
      // Today's names on: a reader placing Pāṭaliputra needs "Patna" beside it.
      spec: AtlasSpec.parse({ focus, modernLabels: true }),
      span: span ? [span[0] - 30, span[1] + 30] : null,
      places,
      initialYear:
        // An event opens on its own year; a place on the age it is mostly read in (Pāṭaliputra:
        // the Mauryas), then its own date (often a founding year).
        (entity.kind === "event" ? yearOf(entity.bounds) : null) ??
        (contextSpan ? Math.floor((contextSpan[0] + contextSpan[1]) / 2) : null) ??
        yearOf(entity.bounds) ??
        (claimBounds ? Math.floor((claimBounds[0] + claimBounds[1]) / 2) : null) ??
        (belongedTo[0] ? Math.floor((belongedTo[0].from + belongedTo[0].to) / 2) : null),
      pin: [entity.id],
    };
  }

  // Nearby places, for a located entity.
  let nearby: Nearby[] = [];
  if (point) {
    const all = await listEntities(["place", "site", "inscription"]).catch(
      () => [] as EntityCard[],
    );
    nearby = all
      .filter((e) => e.id !== entity.id && e.geo)
      .flatMap((e) => {
        const p = pointOf(e.geo!.geometry);
        return p ? [{ entity: e, km: Math.round(km(point, p)) }] : [];
      })
      .filter((n) => n.km <= 600)
      .sort((a, b) => a.km - b.km)
      .slice(0, 6);
  }

  const timeline: TimelineItem[] = [];
  const seen = new Set<string>();
  for (const item of [...ages, ...lens]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    timeline.push(item);
  }

  const main = entity.pageSlug ? summaryBySlug.get(entity.pageSlug) : undefined;
  return {
    detail,
    groups,
    appearsIn,
    atlas,
    timeline,
    pageByEntity,
    belongedTo,
    nearby,
    media,
    partPictures,
    aliasLanguages: entity.aliases.map((a) => languageName(a.lang)),
    mainPage: main ? { slug: main.slug, title: main.title, summary: main.summary } : null,
    gloss,
  };
}

function claimSpan(dates: { edtf: string }[]): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const d of dates) {
    try {
      const b = dateBounds(d.edtf);
      if (b.startMin !== null) lo = Math.min(lo, b.startMin);
      if (b.endMax !== null) hi = Math.max(hi, b.endMax);
    } catch {
      /* an unparseable date adds nothing */
    }
  }
  return Number.isFinite(lo) && Number.isFinite(hi) ? [Math.floor(lo), Math.ceil(hi)] : null;
}
