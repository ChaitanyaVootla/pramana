import { fetchJson, withParams } from "./http";
import {
  citeTemplateToCsl,
  isCiteTemplate,
  parseTemplates,
  shortRef,
  type WikiCitation,
} from "./wikitext";

/**
 * Wikipedia as a DISCOVERY layer: we pin an exact revision, read its outline
 * and text, and mine its citations so claims can be traced to the sources
 * Wikipedia relies on. Wikipedia text is CC BY-SA 4.0; quoting it requires
 * attribution (the revision permalink).
 */

export interface WikipediaSection {
  index: number;
  level: number;
  title: string;
  text: string;
  /** Keys into `citations` used in this section, with page locators. */
  citations: { citation: number; pages: string | null }[];
}

export interface WikipediaArticle {
  lang: string;
  title: string;
  pageId: number;
  revisionId: number;
  /** Permalink to the exact revision used. */
  url: string;
  license: { spdx: "CC-BY-SA-4.0"; attribution: string };
  sections: WikipediaSection[];
  citations: WikiCitation[];
  /** Short refs whose full citation could not be found in the article. */
  unresolvedShortRefs: string[];
}

interface ParseResponse {
  parse?: { title: string; pageid: number; revid: number; wikitext: string };
  error?: { info: string };
}
interface ExtractResponse {
  query: { pages: { extract?: string; missing?: boolean }[] };
}

const HEADING = /^(={2,6})\s*(.+?)\s*\1\s*$/gm;

function splitByHeadings(text: string): { level: number; title: string; body: string }[] {
  const out: { level: number; title: string; body: string }[] = [];
  let last = { level: 1, title: "(lead)", start: 0, headingEnd: 0 };
  HEADING.lastIndex = 0;
  for (let m = HEADING.exec(text); m; m = HEADING.exec(text)) {
    out.push({ level: last.level, title: last.title, body: text.slice(last.headingEnd, m.index) });
    last = {
      level: m[1]!.length,
      title: m[2]!.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1"),
      start: m.index,
      headingEnd: m.index + m[0].length,
    };
  }
  out.push({ level: last.level, title: last.title, body: text.slice(last.headingEnd) });
  return out;
}

export async function getWikipediaArticle(title: string, lang = "en"): Promise<WikipediaArticle> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const parsed = await fetchJson<ParseResponse>(
    withParams(api, {
      action: "parse",
      page: title,
      prop: "wikitext|revid",
      redirects: 1,
      format: "json",
      formatversion: 2,
    }),
    { cacheTtlMs: 24 * 3600 * 1000 },
  );
  if (!parsed.parse)
    throw new Error(
      `Wikipedia (${lang}) article "${title}" not found: ${parsed.error?.info ?? "unknown"}`,
    );
  const { title: canonical, pageid, revid, wikitext } = parsed.parse;

  const extract = await fetchJson<ExtractResponse>(
    withParams(api, {
      action: "query",
      prop: "extracts",
      explaintext: 1,
      exsectionformat: "wiki",
      titles: canonical,
      format: "json",
      formatversion: 2,
    }),
    { cacheTtlMs: 24 * 3600 * 1000 },
  );
  const plain = extract.query.pages[0]?.extract ?? "";

  // Citations: full templates anywhere (inline refs and bibliography sections).
  const templates = parseTemplates(wikitext);
  const citations: WikiCitation[] = [];
  const byKey = new Map<string, number>();
  const byStart = new Map<number, number>();
  for (const t of templates) {
    if (!isCiteTemplate(t)) continue;
    const c = citeTemplateToCsl(t);
    byStart.set(t.start, citations.length);
    if (c.key && !byKey.has(c.key)) byKey.set(c.key, citations.length);
    citations.push(c);
  }

  // Map citations to sections of the wikitext.
  const wikiSections = splitByHeadings(wikitext);
  const textSections = splitByHeadings(plain);
  const unresolved = new Set<string>();
  let offset = 0;
  const sections: WikipediaSection[] = wikiSections.map((ws, index) => {
    const start = wikitext.indexOf(ws.body, offset);
    const end = start + ws.body.length;
    offset = Math.max(offset, end);
    const used: { citation: number; pages: string | null }[] = [];
    for (const t of templates) {
      if (t.start < start || t.end > end) continue;
      const short = shortRef(t);
      if (short) {
        const idx = byKey.get(short.key);
        if (idx === undefined) unresolved.add(short.key);
        else used.push({ citation: idx, pages: short.pages });
      } else if (byStart.has(t.start)) {
        used.push({
          citation: byStart.get(t.start)!,
          pages: t.named.page ?? t.named.pages ?? null,
        });
      }
    }
    const textMatch =
      textSections.find((s) => s.title === ws.title) ?? (index === 0 ? textSections[0] : undefined);
    return {
      index,
      level: ws.level,
      title: ws.title,
      text: (textMatch?.body ?? "").trim(),
      citations: used,
    };
  });

  const url = `https://${lang}.wikipedia.org/w/index.php?title=${encodeURIComponent(canonical.replace(/ /g, "_"))}&oldid=${revid}`;
  return {
    lang,
    title: canonical,
    pageId: pageid,
    revisionId: revid,
    url,
    license: {
      spdx: "CC-BY-SA-4.0",
      attribution: `“${canonical}”, Wikipedia (${lang}), revision ${revid}, ${url}, CC BY-SA 4.0`,
    },
    sections: sections.filter((s) => s.text.length > 0 || s.citations.length > 0),
    citations,
    unresolvedShortRefs: [...unresolved],
  };
}

/** The article's plain text, for capture as a snapshot (quotes from Wikipedia can then be verified). */
export function articlePlainText(article: WikipediaArticle): string {
  return article.sections
    .map((s) =>
      s.index === 0
        ? s.text
        : `${"=".repeat(s.level)} ${s.title} ${"=".repeat(s.level)}\n\n${s.text}`,
    )
    .join("\n\n");
}
