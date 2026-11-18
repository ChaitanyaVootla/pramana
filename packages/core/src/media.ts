import { z } from "zod";
import { DateInput, FuzzyDate } from "./dates";
import { EntityRef } from "./ids";

/**
 * Images (and later other media) from open repositories. Every media record is
 * a real file in a repository (Wikimedia Commons for now) whose licence,
 * author and source were read from the repository's API and stored as a
 * snapshot, never typed from memory. Only free licences are representable:
 * public domain, CC0, CC BY and CC BY-SA (and equivalents). NC, ND, fair use
 * and unknown licences are rejected by `classifyCommonsLicense`.
 *
 * A record also says honestly what the picture is (`representation`): a
 * photograph of the object itself is evidence of a kind; a later painting of
 * Aśoka is an imagining, not a likeness, and the reader is told so.
 */

export const MediaKind = z.enum(["image"]);
export type MediaKind = z.infer<typeof MediaKind>;

export const MediaRepository = z.enum(["wikimedia-commons"]);
export type MediaRepository = z.infer<typeof MediaRepository>;

/** What the picture is, so a reader knows how far to trust it as a view of the past. */
export const Representation = z.enum([
  /** A photograph of the object itself (a sculpture, coin, inscription). */
  "photograph_of_object",
  /** A photograph of a place or monument, as it was when photographed. */
  "photograph_of_site",
  /** A photograph taken at the time of the events or people it shows. */
  "historical_photograph",
  /** A painting, drawing or print made at the time (an 1858 engraving of the revolt). */
  "made_at_the_time",
  /** A drawing, rubbing, cast or facsimile of an object, made later. */
  "copy_of_object",
  /** A later painting or imagining: not a likeness and not a record. */
  "later_imagining",
  /** A map made in the past. */
  "historical_map",
  /** A modern map or reconstruction. */
  "modern_map",
  /** A modern diagram or reconstruction drawing. */
  "diagram",
]);
export type Representation = z.infer<typeof Representation>;

/** Plain words for each representation, shown to readers. */
export const REPRESENTATION_LABELS: Record<Representation, string> = {
  photograph_of_object: "Photograph of the object",
  photograph_of_site: "Photograph of the site",
  historical_photograph: "Photograph taken at the time",
  made_at_the_time: "Picture made at the time",
  copy_of_object: "A later copy or drawing of the object",
  later_imagining: "A later imagining, not a likeness",
  historical_map: "Historical map",
  modern_map: "Modern map",
  diagram: "Modern diagram",
};

/** Representations that must carry a visible warning: they are not a view of the past. */
export function isImagining(r: Representation): boolean {
  return r === "later_imagining";
}

/** How good a picture is as a portrait of an entity (lower is better): evidence first, imaginings last. */
export const REPRESENTATION_RANK: Record<Representation, number> = {
  photograph_of_object: 0,
  photograph_of_site: 0,
  historical_photograph: 0,
  made_at_the_time: 1,
  copy_of_object: 2,
  historical_map: 3,
  modern_map: 4,
  diagram: 4,
  later_imagining: 5,
};

// ---------------------------------------------------------------------------
// Licences
// ---------------------------------------------------------------------------

export const MediaLicenseFamily = z.enum(["public_domain", "cc0", "cc_by", "cc_by_sa"]);
export type MediaLicenseFamily = z.infer<typeof MediaLicenseFamily>;

export const MediaLicense = z.object({
  family: MediaLicenseFamily,
  /** SPDX identifier where one exists ("CC-BY-SA-4.0", "CC0-1.0"); "LicenseRef-Public-Domain" for public domain. */
  spdx: z.string().min(1).max(64),
  /** As the repository writes it: "CC BY-SA 4.0", "Public domain". */
  shortName: z.string().min(1).max(100),
  url: z.url().optional(),
  attributionRequired: z.boolean(),
  /** Why the file is free, from the repository's licence tags: "PD India; PD US expired". */
  basis: z.string().max(1000).optional(),
});
export type MediaLicense = z.infer<typeof MediaLicense>;

export type LicenseVerdict = { ok: true; license: MediaLicense } | { ok: false; reason: string };

export interface CommonsLicenseFields {
  /** extmetadata.License: "cc-by-sa-4.0", "pd", "cc0". */
  license?: string | null;
  /** extmetadata.LicenseShortName: "CC BY-SA 4.0", "Public domain". */
  shortName?: string | null;
  /** extmetadata.LicenseUrl. */
  url?: string | null;
  /** extmetadata.UsageTerms: "Creative Commons Attribution-Share Alike 4.0". */
  usageTerms?: string | null;
  /** extmetadata.AttributionRequired: "true" / "false". */
  attributionRequired?: string | boolean | null;
  /** extmetadata.NonFree: set on fair-use files (other wikis). */
  nonFree?: string | boolean | null;
  /** extmetadata.Categories, "|"-separated. */
  categories?: string | null;
}

const RESTRICTED =
  /(^|[^a-z])(nc|nd)([^a-z]|$)|non-?commercial|no-?deriv|fair[ _-]?use|non-?free|all rights reserved/i;

function truthy(v: string | boolean | null | undefined): boolean {
  return v === true || (typeof v === "string" && /^(true|1|yes)$/i.test(v.trim()));
}

/** Licence and public-domain tags among a file's categories ("PD India", "CC-BY-SA-4.0"). */
export function licenseTags(categories: string | null | undefined): string[] {
  return (categories ?? "")
    .split("|")
    .map((c) => c.trim())
    .filter((c) => /^(PD|CC[- ]|CC0|Public domain|Copyrighted free use)/i.test(c) && !/missing SDC|needs updating/i.test(c));
}

/**
 * Decides whether a Commons file's licence is one we accept, from the API's
 * extmetadata. Accepts public domain, CC0, CC BY and CC BY-SA (any version or
 * port) and the Free Art License (a BY-SA equivalent); rejects NC/ND, fair use, GFDL-only, and anything unrecognised.
 */
export function classifyCommonsLicense(fields: CommonsLicenseFields): LicenseVerdict {
  const code = (fields.license ?? "").trim().toLowerCase();
  const short = (fields.shortName ?? "").trim();
  const terms = (fields.usageTerms ?? "").trim();
  const all = `${code} ${short} ${terms}`;
  if (truthy(fields.nonFree)) return { ok: false, reason: "non-free file (fair use)" };
  if (!code && !short) return { ok: false, reason: "no licence stated" };
  if (RESTRICTED.test(all.replace(/-/g, " ")) || RESTRICTED.test(all))
    return { ok: false, reason: `restricted licence (${short || code}): no NC, ND or fair use` };

  const url = fields.url && /^https?:\/\//.test(fields.url) ? fields.url.replace(/^http:/, "https:") : undefined;
  const tags = licenseTags(fields.categories);
  const basis = tags.length ? `Commons licence tags: ${tags.join("; ")}` : undefined;
  const attribution = (fallback: boolean) =>
    fields.attributionRequired === undefined || fields.attributionRequired === null || fields.attributionRequired === ""
      ? fallback
      : truthy(fields.attributionRequired);
  const make = (family: MediaLicenseFamily, spdx: string, fallbackShort: string, attr: boolean): LicenseVerdict => ({
    ok: true,
    license: {
      family,
      spdx,
      shortName: short || fallbackShort,
      ...(url ? { url } : {}),
      attributionRequired: attr,
      ...(basis ? { basis } : {}),
    },
  });

  const key = code || short.toLowerCase().replace(/\s+/g, "-");
  if (/^cc0\b|^cc-zero|^cc0-1\.0/.test(key) || /^cc0$/i.test(short)) return make("cc0", "CC0-1.0", "CC0", attribution(false));
  if (/^pdm|public-domain-mark/.test(key)) return make("public_domain", "CC-PDM-1.0", "Public domain", attribution(false));
  if (/^pd\b|^pd-|^public[- ]domain/.test(key) || /^public domain$/i.test(short))
    return make("public_domain", "LicenseRef-Public-Domain", "Public domain", attribution(false));

  const cc = /^cc-by(-sa)?-(\d(?:\.\d)?)(?:-([a-z]{2,3}))?\b/.exec(key) ?? ccFromShortName(short);
  if (cc) {
    const [, sa, version, port] = cc;
    const v = version!.includes(".") ? version! : `${version}.0`;
    const spdx = `CC-BY${sa ? "-SA" : ""}-${v}${port && port !== "migrated" ? `-${port.toUpperCase()}` : ""}`;
    return make(sa ? "cc_by_sa" : "cc_by", spdx, `CC BY${sa ? "-SA" : ""} ${v}`, attribution(true));
  }
  // Commons {{Attribution}}: any use, credit required. Equivalent to CC BY.
  if (key === "attribution") return make("cc_by", "LicenseRef-Attribution", "Attribution", attribution(true));
  // Free Art License: copyleft, declared compatible with CC BY-SA 4.0 by Creative Commons.
  if (/^fal\b|^free[- ]art/.test(key) || /^FAL\b/.test(short))
    return make("cc_by_sa", "LicenseRef-FAL-1.3", "Free Art License", attribution(true));
  if (/gfdl/.test(key))
    return { ok: false, reason: "GFDL only: it requires the full licence text with every copy; look for a CC-licensed file" };
  return { ok: false, reason: `unrecognised licence "${short || code}"` };
}

function ccFromShortName(short: string): RegExpExecArray | null {
  const m = /^CC BY(-SA)? (\d(?:\.\d)?)(?: ([a-z]{2,3}))?$/i.exec(short.trim());
  if (!m) return null;
  return m as RegExpExecArray;
}

// ---------------------------------------------------------------------------
// Commons API metadata (imageinfo + extmetadata), parsed
// ---------------------------------------------------------------------------

/** Decodes HTML entities and strips tags: extmetadata values are HTML fragments. */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—" };
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|tr)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
      }
      return named[e.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** Upload URLs as stable identifiers: https, no tracking query string. */
export function cleanCommonsUrl(url: string): string {
  const u = new URL(url);
  u.protocol = "https:";
  u.search = "";
  u.hash = "";
  return u.toString();
}

/** "File:Lion capital of Ashoka, Sarnath.jpg" (spaces, not underscores, with the namespace). */
export function normalizeFileTitle(title: string): string {
  const path = title.replace(/^https?:\/\/[^/]+\/wiki\//, "");
  let t = path;
  try {
    t = decodeURIComponent(path);
  } catch {
    // Not URL-encoded: keep it as given.
  }
  t = t.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  const bare = t.replace(/^(File|Image):/i, "");
  return `File:${bare.charAt(0).toUpperCase()}${bare.slice(1)}`;
}

const ExtValue = z.object({ value: z.union([z.string(), z.number(), z.boolean()]) }).loose();

/** The shape of one page from `prop=imageinfo&iiprop=url|size|mime|sha1|extmetadata` (formatversion=2). */
export const CommonsImageInfoPage = z
  .object({
    title: z.string(),
    missing: z.boolean().optional(),
    /**
     * Everyone who uploaded a version, oldest first. Not part of the API's
     * page object: the connector adds it for "Own work" files, whose author
     * is the first uploader.
     */
    uploaders: z.array(z.string()).optional(),
    imageinfo: z
      .array(
        z
          .object({
            url: z.string(),
            descriptionurl: z.string(),
            width: z.number().int(),
            height: z.number().int(),
            mime: z.string(),
            sha1: z.string().optional(),
            size: z.number().optional(),
            thumburl: z.string().optional(),
            /** The uploader; the author when the file page says "Own work". */
            user: z.string().optional(),
            timestamp: z.string().optional(),
            extmetadata: z.record(z.string(), ExtValue).default({}),
          })
          .loose(),
      )
      .optional(),
  })
  .loose();
export type CommonsImageInfoPage = z.infer<typeof CommonsImageInfoPage>;

export interface CommonsFile {
  fileTitle: string;
  pageUrl: string;
  originalUrl: string;
  width: number;
  height: number;
  mime: string;
  sha1: string | null;
  bytes: number | null;
  /** The licence verdict: only `ok` files can become media records. */
  license: LicenseVerdict;
  /** Author as plain text ("lisa bat", "Felice Beato"); null when Commons gives none. */
  artist: string | null;
  /** Source line as plain text (a Flickr URL, "Own work", a book). */
  credit: string | null;
  description: string | null;
  /** The file's own date as Commons states it ("2020-02-18", "circa 1930"). */
  dateText: string | null;
  /** That date as EDTF, when it is plainly a year, month or day. */
  date: FuzzyDate | null;
  categories: string[];
  /** Non-copyright restrictions Commons records (personality rights, insignia). */
  restrictions: string[];
}

/** A Commons date ("2020-02-18", "1930", "circa 1857", "1858-03-01 00:00:00") as EDTF, or null. */
export function commonsDateToEdtf(text: string | null | undefined): FuzzyDate | null {
  const t = htmlToPlainText(text ?? "").trim();
  if (!t) return null;
  const approximate = /^(circa|ca\.?|c\.|about)\s*/i.exec(t);
  const rest = approximate ? t.slice(approximate[0].length) : t;
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.exec(rest.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  if (mo === "00" || d === "00") return null;
  const edtf = `${y}${mo ? `-${mo}` : ""}${d ? `-${d}` : ""}${approximate ? "~" : ""}`;
  return { edtf, basis: "Wikimedia Commons file date" };
}

function ext(meta: Record<string, { value: string | number | boolean }>, key: string): string | null {
  const v = meta[key]?.value;
  return v === undefined || v === null ? null : String(v);
}

/**
 * Commons renders "Unknown author" with a hidden translated copy, which plain
 * text runs together ("Unknown authorUnknown author"); keep one.
 */
export function cleanArtist(artist: string | null): string | null {
  if (!artist) return null;
  const once = artist
    .replace(/(Unknown (?:author|artist|photographer)|Anonymous)\s*(?=Unknown (?:author|artist|photographer)|Anonymous)/gi, "")
    .trim();
  return once || null;
}

/**
 * "Own work" means the first uploader made it; later versions may be by
 * others, who are credited as "other contributors".
 */
export function ownWork(artist: string | null, uploaders: string[]): string | null {
  if (!artist || !/^own work\.?$/i.test(artist.trim()) || !uploaders.length) return artist;
  const [first, ...rest] = uploaders;
  return rest.some((u) => u !== first) ? `${first} and other contributors` : first!;
}

/** True when the author is not known (no name to credit). */
export function isUnknownArtist(artist: string | null | undefined): boolean {
  return !artist || /^(unknown( (author|artist|photographer))?|anonymous|(author|artist) unknown|not stated)\.?$/i.test(artist.trim());
}

/** Parses one imageinfo page into what a media record needs. Throws if the page is missing. */
export function parseCommonsImageInfo(raw: unknown): CommonsFile {
  const page = CommonsImageInfoPage.parse(raw);
  const info = page.imageinfo?.[0];
  if (page.missing || !info) throw new Error(`Commons file ${page.title} not found`);
  const meta = info.extmetadata as Record<string, { value: string | number | boolean }>;
  const categories = (ext(meta, "Categories") ?? "").split("|").filter(Boolean);
  const plain = (key: string) => htmlToPlainText(ext(meta, key)) || null;
  const dateText = plain("DateTimeOriginal");
  return {
    fileTitle: normalizeFileTitle(page.title),
    pageUrl: cleanCommonsUrl(info.descriptionurl),
    originalUrl: cleanCommonsUrl(info.url),
    width: info.width,
    height: info.height,
    mime: info.mime,
    sha1: info.sha1 ?? null,
    bytes: info.size ?? null,
    license: classifyCommonsLicense({
      license: ext(meta, "License"),
      shortName: ext(meta, "LicenseShortName"),
      url: ext(meta, "LicenseUrl"),
      usageTerms: ext(meta, "UsageTerms"),
      attributionRequired: ext(meta, "AttributionRequired"),
      nonFree: ext(meta, "NonFree"),
      categories: ext(meta, "Categories"),
    }),
    artist: ownWork(cleanArtist(plain("Artist")), page.uploaders ?? (info.user ? [info.user] : [])),
    credit: plain("Credit"),
    description: plain("ImageDescription"),
    dateText,
    date: commonsDateToEdtf(dateText),
    categories,
    restrictions: (ext(meta, "Restrictions") ?? "").split("|").filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

/**
 * Widths Wikimedia pre-renders and caches. Other widths are refused (HTTP 400)
 * since Wikimedia standardised thumbnail sizes, so every srcset uses these.
 */
export const COMMONS_THUMB_WIDTHS = [120, 250, 330, 500, 960, 1280, 1920, 3840] as const;

/** Formats a browser cannot show directly; they are always served as rendered thumbnails. */
const THUMB_SUFFIX: Record<string, string> = {
  "image/tiff": ".jpg",
  "image/svg+xml": ".png",
  "image/webp": "",
  "image/jpeg": "",
  "image/png": "",
  "image/gif": "",
};

/**
 * The URL of a Commons thumbnail at least `width` wide (snapped to a standard
 * width), or the original when it is no wider than that and the browser can
 * show it as it is.
 */
export function commonsThumbUrl(
  file: { originalUrl: string; width: number; mime: string },
  width: number,
): string {
  const original = cleanCommonsUrl(file.originalUrl);
  const suffix = THUMB_SUFFIX[file.mime] ?? ".jpg";
  const direct = isDirect(file.mime);
  const snapped = COMMONS_THUMB_WIDTHS.find((w) => w >= width) ?? COMMONS_THUMB_WIDTHS.at(-1)!;
  if (direct && snapped >= file.width) return original;
  // Raster formats are not upscaled: ask for the largest standard width below the original.
  const usable =
    file.mime === "image/svg+xml" || snapped < file.width ? snapped : (largestThumbBelow(file.width) ?? snapped);
  const m = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f]\/[0-9a-f]{2})\/([^/]+)$/.exec(original);
  if (!m) return original;
  const [, base, hash, name] = m;
  return `${base}/thumb/${hash}/${name}/${usable}px-${name}${suffix}`;
}

function isDirect(mime: string): boolean {
  return THUMB_SUFFIX[mime] === "";
}

function largestThumbBelow(width: number): number | undefined {
  return [...COMMONS_THUMB_WIDTHS].reverse().find((w) => w < width);
}

/** A `srcset` of standard thumbnail widths up to the original's width (or `max`). */
export function commonsSrcSet(file: { originalUrl: string; width: number; mime: string }, max = 1920): string {
  const widths = COMMONS_THUMB_WIDTHS.filter((w) => w <= max && w < file.width);
  const parts = widths.map((w) => `${commonsThumbUrl(file, w)} ${w}w`);
  if (isDirect(file.mime) && file.width <= max) parts.push(`${cleanCommonsUrl(file.originalUrl)} ${file.width}w`);
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

/**
 * The author of a photograph is its photographer, even when the photograph
 * shows a painting or a relief, so only photographs get a "Photo:" label;
 * for drawings, maps and scans the name stands on its own.
 */
const PHOTOGRAPHS = new Set<Representation>(["photograph_of_object", "photograph_of_site", "historical_photograph"]);

/** "Photo: lisa bat, CC BY 2.0, via Wikimedia Commons": the credit line a licence asks for. */
export function mediaAttribution(m: {
  artist?: string | null;
  license: Pick<MediaLicense, "shortName" | "family">;
  representation: Representation;
  repository: MediaRepository;
}): string {
  const artist = isUnknownArtist(m.artist) ? null : m.artist!.trim();
  const name = artist && artist.length > 120 ? `${artist.slice(0, 117)}…` : artist;
  const who = name ? (PHOTOGRAPHS.has(m.representation) ? `Photo: ${name}` : name) : null;
  const licence = m.license.family === "public_domain" ? "public domain" : m.license.shortName;
  const where = m.repository === "wikimedia-commons" ? "via Wikimedia Commons" : m.repository;
  return [who, who ? licence : licence.charAt(0).toUpperCase() + licence.slice(1), where].filter(Boolean).join(", ");
}

// ---------------------------------------------------------------------------
// Fields of a media record, as ops write them
// ---------------------------------------------------------------------------

/** Where to keep in frame when an image is cropped (hero, thumbnails): 0..1 from the left and top. */
export const MediaFocus = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export type MediaFocus = z.infer<typeof MediaFocus>;

/** Fields read from the repository's API (checked against the snapshot on apply). */
export const MediaFileFields = {
  pageUrl: z.url(),
  originalUrl: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mime: z.string().regex(/^image\/[a-z0-9.+-]+$/),
  sha1: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
  license: MediaLicense,
  artist: z.string().max(500).optional(),
  credit: z.string().max(1000).optional(),
  /** The credit line the licence requires, shown with the image. */
  attribution: z.string().min(1).max(600),
  /** The repository's own description, as plain text. */
  description: z.string().max(4000).optional(),
  /** The API response this record was made from (a snapshot of kind "commons"). */
  snapshotId: z.uuid(),
  retrievedAt: z.iso.datetime(),
};

/** Editorial fields: ours, about what the picture shows. */
export const MediaEditorialFields = {
  /** Short, plain title: "Lion Capital of Aśoka". */
  title: z.string().min(1).max(200),
  /** What a screen reader says: what is in the picture, not what it means. */
  alt: z.string().min(1).max(500),
  representation: Representation,
  /** Shown with imaginings and copies: "Painted in 1912; no likeness of Aśoka survives." */
  representationNote: z.string().max(500).optional(),
  /** The date of the thing shown (the capital, c. 250 BCE), as opposed to the photograph. */
  objectDate: DateInput.optional(),
  /** The date the photograph or picture was made. Defaults to the repository's date when it is plain. */
  imageDate: DateInput.optional(),
  /** Entities the picture shows (the object, the site, the person). */
  depicts: z.array(EntityRef).max(20).optional(),
  focus: MediaFocus.optional(),
};
