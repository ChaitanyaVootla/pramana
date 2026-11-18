import { cleanArtist, isUnknownArtist, type Representation } from "@pramana/core";
import type { MediaCard } from "@pramana/services";

/**
 * Credit lines for readers. The stored attribution is exactly what the Commons
 * API says (apply checks it), and the dialog shows it in full. Under a picture
 * the same credit is tidied for learners: wiki housekeeping ("(talk)",
 * "Date=…", life dates, "Unknown author" beside a named publisher, Flickr's
 * "from <place>") is dropped, and very long author fields are shortened. The
 * author and licence are always kept, with the link to the file page.
 */

const PHOTOGRAPHS = new Set<Representation>(["photograph_of_object", "photograph_of_site", "historical_photograph"]);

export function displayArtist(raw: string | null | undefined): string | null {
  const cleaned = cleanArtist(raw ?? null);
  if (!cleaned || isUnknownArtist(cleaned)) return null;
  let s = cleaned
    // Wiki signatures: "Name (talk) 10:13, 30 August 2022 (UTC)".
    .replace(/\s*\(talk\)(\s*\d{1,2}:\d{2},[^()]*\(UTC\))?/gi, "")
    .replace(/\s*\d{1,2}:\d{2}, \d{1,2} \w+ \d{4} \(UTC\)/g, "")
    // Template residue and footnote markers.
    .replace(/\s*Date=.*$/i, "")
    .replace(/\s*date QS:.*$/i, "")
    .replace(/\s*\[\d+\]/g, "")
    // Dates of the object or of the author's life, in brackets.
    .replace(/\s*\([^()]*\bcentury\b[^()]*\)/gi, "")
    .replace(/\s*\((?:died |d\. |born |b\. )?[^()]*\d{3,4}[^()]*\)/gi, "")
    // "Name at English Wikipedia", Flickr's "Name from Place".
    .replace(/\s+at [A-Z][a-z]+ Wikipedia\b/g, "")
    .replace(/\bby me\s+/gi, "by ")
    .trim();
  // "Unknown author" beside a name or a publisher says nothing.
  if (/^(unknown author|anonymous)\b/i.test(s) && s.replace(/^(unknown author|anonymous)\s*/i, "").length > 2)
    s = s.replace(/^(unknown author|anonymous)\s*/i, "").replace(/^\((.*)\)$/, "$1");
  // A trailing year ("Beglar, Joseph David, 1870", "Thomas A. Rust circa 1870") is the picture's date, shown elsewhere.
  s = s.replace(/,?\s+(circa\s+|c\.\s*)?\d{4}$/i, "");
  s = s.replace(/\.{2,}$/, "").replace(/[\s.;,:]+$/, "").trim();
  // Long fields that list several hands ("Thomas A. Rust circa 1870 (photograph) Rubbing: …",
  // "CNG Coins Coin from CNG coins. Used with permission …"): name the first, then "and others".
  const first = /^(.{3,40}?)(?:(?<=[a-z]{2})\.\s|\s(?:circa|\(photograph\)|Coin|Used|Photograph|Rubbing)\b)/.exec(s);
  if (s.length > 50 && first) s = `${first[1]!.trim()} and others`;
  // Flickr imports: "Name from Place, Country".
  s = s.replace(/^(.{2,}?)\s+from\s+[A-Z].*$/, "$1");
  if (s.length > 70) s = `${s.slice(0, 60).replace(/\s+\S*$/, "")} and others`;
  return s || null;
}

/** "Photo: lisa bat, CC BY 2.0, Wikimedia Commons" for display under a picture. */
export function displayCredit(media: Pick<MediaCard, "artist" | "license" | "representation" | "repository">): string {
  const artist = displayArtist(media.artist);
  const licence = media.license.family === "public_domain" ? "public domain" : media.license.shortName;
  const who = artist ? (PHOTOGRAPHS.has(media.representation) ? `Photo: ${artist}` : artist) : null;
  return [who, who ? licence : licence.charAt(0).toUpperCase() + licence.slice(1), "Wikimedia Commons"].filter(Boolean).join(", ");
}

function when(label: string): string {
  if (/^(c\.|about |from |until )/.test(label)) return label;
  if (/^\d{1,2} [A-Z][a-z]{2} /.test(label)) return `on ${label}`;
  return `in ${label}`;
}

/** What the picture is, and when, in one plain line without repeating itself. */
export function mediaKindLine(
  media: Pick<MediaCard, "representation" | "representationLabel" | "imageDateLabel" | "objectDateLabel">,
): string {
  switch (media.representation) {
    case "historical_photograph":
      return media.imageDateLabel ? `Photograph taken ${when(media.imageDateLabel)}` : media.representationLabel;
    case "made_at_the_time":
      return media.imageDateLabel ? `Picture made ${when(media.imageDateLabel)}` : media.representationLabel;
    case "later_imagining":
      return media.representationLabel;
    default:
      if (!media.objectDateLabel) return media.representationLabel;
      return `${media.representationLabel}, made ${/century/.test(media.objectDateLabel) ? `in the ${media.objectDateLabel}` : when(media.objectDateLabel)}`;
  }
}

/** What a licence lets a reader do, in plain words (the rights badge in the viewer). */
export function rightsInPlainWords(license: MediaCard["license"]): { label: string; detail: string } {
  switch (license.family) {
    case "public_domain":
      return { label: "Public domain", detail: "Free to use for any purpose. Crediting the source is still good practice." };
    case "cc0":
      return { label: "No rights reserved (CC0)", detail: "Free to use for any purpose, without asking." };
    case "cc_by":
      return { label: "Free to reuse with credit", detail: `Use, share or adapt it, as long as you credit it as below (${license.shortName}).` };
    case "cc_by_sa":
      return {
        label: "Free to reuse with credit, share alike",
        detail: `Use, share or adapt it with the credit below; anything you make from it must carry the same licence (${license.shortName}).`,
      };
  }
}

/**
 * A full credit to copy and paste: title, author, licence with its link, and
 * the file page. This is the form the licences ask for (title, author, source,
 * licence).
 */
export function copyableCredit(
  media: Pick<MediaCard, "title" | "artist" | "license" | "pageUrl" | "representation" | "repository">,
): string {
  const artist = displayArtist(media.artist);
  const licence = media.license.family === "public_domain" ? "public domain" : media.license.shortName;
  const licenceRef = media.license.url ? `${licence} (${media.license.url})` : licence;
  return `“${media.title}”${artist ? `, ${artist}` : ""}, ${licenceRef}, via Wikimedia Commons: ${media.pageUrl}`;
}
