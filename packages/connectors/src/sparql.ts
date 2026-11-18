import { fetchJson, withParams, type FetchOptions } from "./http";

/**
 * Wikidata Query Service (SPARQL). Use it to DISCOVER items (holders of a
 * position, participants in a war); read dates from the entity JSON instead
 * (getWikidataItems), which keeps the precision, calendar and qualifiers.
 * WDQS time literals are astronomical xsd:dateTime values without precision,
 * so "-0267-01-01" may stand for a whole century.
 */

const ENDPOINT = "https://query.wikidata.org/sparql";

export interface SparqlTerm {
  type: "uri" | "literal" | "bnode" | "typed-literal";
  value: string;
  datatype?: string;
  "xml:lang"?: string;
}
export type SparqlRow = Record<string, SparqlTerm | undefined>;

/** Runs a SELECT query; results are cached on disk like other requests (default 7 days). */
export async function sparqlSelect(query: string, options: FetchOptions = {}): Promise<SparqlRow[]> {
  const url = withParams(ENDPOINT, { query, format: "json" });
  const data = await fetchJson<{ results: { bindings: SparqlRow[] } }>(url, {
    accept: "application/sparql-results+json",
    ...options,
  });
  return data.results.bindings;
}

/** "http://www.wikidata.org/entity/Q8589" -> "Q8589"; null for anything else. */
export function qidFromUri(uri: string | undefined): string | null {
  const m = uri ? /\/entity\/(Q\d+)$/.exec(uri) : null;
  return m ? m[1]! : null;
}

/** QIDs bound to `variable` in a query's results, in order, without duplicates. */
export async function sparqlQids(query: string, variable = "item"): Promise<string[]> {
  const rows = await sparqlSelect(query);
  const out: string[] = [];
  for (const row of rows) {
    const qid = qidFromUri(row[variable]?.value);
    if (qid && !out.includes(qid)) out.push(qid);
  }
  return out;
}
