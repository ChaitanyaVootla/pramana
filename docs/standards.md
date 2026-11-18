# Standards

The platform stores history as structured data. Wherever an established standard exists, we use it, so the data can be exchanged, checked and outlived. This page records each choice and the reasons for it.

## Dates: EDTF (ISO 8601-2:2019)

Dates are stored as **EDTF** strings, the Extended Date/Time Format specified by the Library of Congress and incorporated into ISO 8601-2:2019. EDTF can express what history needs and ISO 8601-1 cannot:

| Need               | EDTF            | Meaning                   |
| ------------------ | --------------- | ------------------------- |
| approximate        | `-0321~`        | about 322 BCE             |
| uncertain          | `-0299?`        | 300 BCE, uncertain        |
| both               | `-0299%`        | approximate and uncertain |
| unspecified digits | `194X`          | the 1940s                 |
| interval           | `-0321/-0184`   | 322–185 BCE               |
| open end           | `1947-08-15/..` | from 15 Aug 1947          |
| long years         | `Y-10000`       | 10,001 BCE                |

**Years are astronomical.** ISO 8601 and EDTF number years astronomically: `0000` is 1 BCE, `-0001` is 2 BCE, `-0321` is 322 BCE. Hand-writing negative years invites off-by-one errors, so every input accepts a friendlier form, `{ "year": 322, "era": "BCE", "approximate": true }`, which is converted on write (`packages/core/src/dates.ts`). Display always uses BCE/CE.

**Calendar.** Values are proleptic Gregorian, as in ISO 8601. A date as the source states it goes in `asStated` with its calendar, for example a regnal year ("anointed eight years"), Vikram Samvat, Śaka, Hijri or the Buddhist era. How the date was established goes in `basis`.

**Derived bounds.** For sorting, filtering and drawing, each date also stores numeric bounds (earliest start, latest start, earliest end, latest end) as decimal astronomical years. The EDTF string remains the source of truth. Parsing uses [edtf.js](https://github.com/inukshuk/edtf.js) (BSD-2-Clause).

**Wikidata.** Wikidata's JSON uses _historical_ numbering, with no year 0: `-0044` is 44 BCE. Its RDF export and ISO use astronomical numbering. The importer shifts BCE years by one. It turns decade, century and millennium precision into intervals, and converts Julian-calendar day dates to Gregorian (`wikidataTimeToEdtf`). Unit tests cover all three.

## Citations

| Concern                         | Standard                                                                                                                                     | Where                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Bibliographic records           | **CSL-JSON** (Citation Style Language), used by Zotero, Pandoc and Crossref                                                                  | `sources.csl`; full styles can be rendered later with citeproc |
| Persistent identifiers          | DOI, ISBN, OCLC, Internet Archive id, Open Library id, Wikidata QID, HathiTrust                                                              | `sources.identifiers`                                          |
| Work vs edition                 | FRBR-style: a translation or edition `derivedFrom` its work (Arthaśāstra → Shamasastry 1915)                                                 | `sources.derived_from_id`                                      |
| Where in the source             | Locators: page, volume, chapter, verse, edict and line, folio, timestamp                                                                     | `excerpts.locator`                                             |
| Which characters                | **W3C Web Annotation Data Model**: `TextQuoteSelector` (exact + prefix/suffix) and `TextPositionSelector` (offsets) into the stored snapshot | `excerpts.selector`                                            |
| How an excerpt bears on a claim | supports / contradicts / qualifies / mentions (cf. scite.ai)                                                                                 | `citations.stance`                                             |
| Licences                        | **SPDX** identifiers, plus a public-domain/copyright status and its basis                                                                    | `sources.license`                                              |
| Web pages                       | Snapshot text plus a Wayback Machine copy (Memento-style lookup)                                                                             | `snapshots.archive_url`                                        |

The CSL-JSON → Wikidata reference mapping is: `stated in` (P248) = source, `page(s)` (P304) = locator, `quotation` (P1683) = excerpt quote, `retrieved` (P813) = snapshot `captured_at`, `reference URL` (P854) = URL. This keeps an export to Wikidata references straightforward.

**Discovery is not evidence.** How a claim was _found_ (for example via Wikipedia revision 1379792709) is stored separately (`claims.found_via`) from what _supports_ it (citations). Wikipedia is a tertiary source. We pin the exact revision and mine its structured citation templates (`{{cite book}}`, `{{sfn}}`) to reach the sources it relies on.

**Copyright.** Indian copyright for literary works lasts for the author's life plus 60 years. In the US, works published before 1931 are in the public domain as of 2026. Each source records its status and the reasoning. Copyrighted modern scholarship is cited by location, or with short quotations only.

## Provenance and audit: W3C PROV

The audit log maps onto PROV-O:

- actor = `prov:Agent`;
- `on_behalf_of` = `prov:actedOnBehalfOf`;
- event = `prov:Activity`;
- subject = `prov:Entity`;
- `sources.derived_from` = `prov:wasDerivedFrom`;
- an excerpt = `prov:wasQuotedFrom` its source.

A PROV export is therefore a mapping, not a redesign.

## Places: GeoJSON (RFC 7946), with Linked Places in mind

Geometry is GeoJSON, with coordinates as `[longitude, latitude]`. Each location carries a `certainty`:

- `exact`: surveyed;
- `approximate`;
- `conjectural`: a scholarly reconstruction.

Historical gazetteers (the World Historical Gazetteer, OpenHistoricalMap) use the **Linked Places Format**, a GeoJSON-LD extension. It adds `when` (timespans with `start`/`end`, each `in` or `earliest`/`latest`), `names` with language and citations, typed `relations`, and `links` (closeMatch, exactMatch) to other gazetteers. Our entity model (names with languages, fuzzy dates, Wikidata links, entity links) maps onto it for import and export.

## Names, languages and scripts

- Language: **BCP 47** tags (`sa`, `hi`, `fa`, `sa-Latn` for IAST-romanised Sanskrit).
- Script: **ISO 15924** codes (`Deva`, `Arab`, `Brah` for Brāhmī).
- Text is stored in Unicode **NFC**. Search and quote matching fold diacritics, so "asoka" finds "Aśoka".
- Names that carry a stance (Indus Valley vs Sindhu-Sarasvati) are recorded as aliases, with a note on who uses each.

## Arguments

Claims and typed relations (supports, contradicts, qualifies, context for, corrects) are a simplified form of the **Argument Interchange Format** (AIF). In AIF terms, a claim is an I-node and a relation is an RA/CA node. AIF itself has seen little tool uptake, so we keep a smaller model that maps onto it, rather than adopting it wholesale.

## Learning

Scheduling uses **FSRS** via [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs). Its card state is stored as JSON, so the scheduler can be swapped or re-fitted later.

**Confidence and ratings.** Before an answer is shown the learner says how sure they are, in three levels stored as percentages for calibration (just a guess = 30, fairly sure = 65, sure = 90). After it they say whether they were right, and the FSRS rating follows (`ratingFor` in `packages/core/src/learn.ts`):

| Right? | How sure   | FSRS rating                              |
| ------ | ---------- | ---------------------------------------- |
| no     | any        | Again                                    |
| yes    | a guess    | Hard (weak retrieval comes back sooner)  |
| yes    | fairly     | Good                                     |
| yes    | sure       | Good, or Easy if the learner says so     |

**Hypercorrection.** A wrong answer given as "sure" flags the card (`cards.confident_error_at`). FSRS's Again already brings it back within minutes, and the study session asks it once more before it ends. On the first right answer after that, the next review is capped at two days (`CONFIDENT_ERROR_RECHECK_DAYS`) and the flag cleared: confident errors are corrected more often after feedback (Butterfield & Metcalfe 2001), but the old belief tends to return within a week (Butler, Fazio & Marsh 2011).

**Guesses, checks and prior beliefs** are stored in `learner_responses` (the learner, page, block, item, the zod-validated response and result, confidence), each with an audit event (`guess.recorded`, `check.answered`, `belief.recorded`). The server grades them: a guess against the block's answer (numbers and years within a tolerance count as close); order questions against the claims' stored dates (questions whose dates overlap are refused); place questions by great-circle distance to the entity's stored point, from Wikidata, within the block's tolerance. Recall is graded by the learner against the claim. Only the first guess counts; every check attempt is kept. A recall answer on a claim in the deck is also an FSRS review.

**First steps and chapter progress.** A learner with no activity is offered two questions before reading anything (`firstSteps`, `FirstSteps`): put three or four ages with pages in order, graded against the ages' stored start dates, and tap where Pāṭaliputra was, graded against its Wikidata point. They are stored like other answers (kind `first`, no page) and can be skipped. A chapter counts as read once its end has been on screen (kind `read`, recorded once). Each chapter's progress is drawn with the evidence seal's four cells, one per step: read, guessed first, checked, and remembered later (at least half of its claims in the learner's reviews answered right after FSRS has moved them past the learning steps).

**Recall prompts.** A claim's card asks its `learning.prompt` when it has one, and "How well supported is this?" only otherwise, so era pages get prompts for every claim (`scripts/seed/learn-prompts.ts`, written per page in `scripts/seed/learn-prompts/`). No answer is stored with them: the card's answer is the claim's own text, and a prompt may use only names and numbers its claim states (`ungroundedTerms` in `packages/core/src/learn.ts`). Due cards are ordered recall first, evidence questions after.

**New cards a day.** Reviews of cards already met are never held back, but new cards are met at most `PRAMANA_NEW_CARDS_PER_DAY` (default 20) a day, oldest in the deck first (`todaysCards`), so adding a whole page does not bury a beginner. /learn says it plainly ("Today: 4 reviews and 15 new cards. 110 more new cards wait for the coming days, 20 a day"), and every count of what is due (the session, the era filter, progress) uses the same rule.

**Skimmed and read.** A part whose one-minute summary has been on screen counts as skimmed (kind `skim`); one read to its end counts as read. The chapter seal half-fills its first cell for skimmed. A "Guess first" question can be skipped (kind `skip`, and then not guessed later); while it is open, the part's summary keeps the answer out of sight (`usePartGuess`). /learn suggests first the part whose guess was furthest off (`guessMiss`) and that has not been read in full.

**Answers fill the deck.** The claim that answers a guess, and the claims behind any check question answered, go into the learner's reviews automatically (a recall answer counts as the card's first review); "Add this part to my reviews" adds the rest of a part. New cards still wait for the daily allowance. Scores count only what was answered ("1 of 1 right, 2 not tried"), and "remembered" only cards that have been reviewed.

**Today.** `/learn/today` runs one session: the next part (`nextPart`: the first part not yet studied on the page studied last, else where the first steps pointed), its guess and one-minute summary, its check (only questions the summary answers: their claims are linked in it, or the place is named), the cards due, then "What you met today" (`learnedToday`: the claims behind today's answers, each with its seal). `agesStrip` gives each era's state (untouched, begun, read, remembered) for "Where you have been". `scripts/learn-spoilers.ts` lists guesses whose answer is shown before they are asked (lede, "You may already know", the part's title or rail, first steps).

**Testing as someone else.** Every learner action must be the learner's own, so tests never answer as the real user. Use a separate test learner on the preview database: `DATABASE_URL=…/pramana_preview pnpm tsx scripts/learn-smoke.ts` answers a guess, each kind of check question, a belief and two reviews as the human actor `test-learner` ("Test learner (preview)") and checks the grading and scheduling. For clicking through the UI (even just opening a page records a visit), run the preview dev server as that learner: add `PRAMANA_USER_HANDLE=test-learner PRAMANA_USER_NAME="Test learner (preview)"` to the preview server command in `CLAUDE.md`. The grading and scheduling rules themselves are unit-tested in `packages/core/src/learn.test.ts`.

## References

- Library of Congress, Extended Date/Time Format: <https://www.loc.gov/standards/datetime/>
- Wikidata time datatype and BCE numbering: <https://phabricator.wikimedia.org/T99674>, <https://zff.dev/maxlath/wikibase-sdk/issues/54>
- Linked Places Format: <https://github.com/LinkedPasts/linked-places-format>
- W3C Web Annotation Data Model: <https://www.w3.org/TR/annotation-model/>
- W3C PROV-O: <https://www.w3.org/TR/prov-o/>
- CSL-JSON schema: <https://github.com/citation-style-language/schema>
- Argument Interchange Format: <https://en.wikipedia.org/wiki/Argument_Interchange_Format>
- Wikidata MCP: <https://www.wikidata.org/wiki/Wikidata:MCP>

## Historical extents: GeoJSON MultiPolygons with dataset provenance

Borders are GeoJSON (RFC 7946) MultiPolygons: closed rings, outer rings counterclockwise, coordinates `[longitude, latitude]`. Each extent applies to an inclusive range of **astronomical** integer years (`fromYear <= y <= toYear`), carries its dataset and row identifiers, an SPDX licence and the attribution the licence requires, and is a `reconstruction` (a mapped scholarly reconstruction at map scale, not a surveyed line).

**Cliopatria.** [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) (Seshat Global History Databank; Bennett et al. 2025, doi:10.1038/s41597-025-04516-9) is CC BY 4.0: credit, link the licence, indicate changes. Every imported extent records "after Cliopatria (Seshat Global History Databank), CC BY 4.0, simplified and clipped", and its note states the clip window and simplification tolerance.

Its README says years are "integers, negative for BCE, positive for CE". We read that as **historical** numbering: Cliopatria's -318 is 318 BCE, astronomical -317 (`cliopatriaYearToAstronomical`). The data also uses year 0 to close BCE ranges (`-50..0` followed by `1..13`), which historical numbering does not have; we store it as astronomical 0 (1 BCE). If the dataset is in fact astronomical, BCE boundaries are one year early, which is well within the precision of the reconstructions. `Area` (km², EPSG:6933) is stored as given, for the whole unclipped polity.

Cliopatria's Wikidata ids are not all right (a disambiguation page for Kalinga, a city for Anurādhapura, "Chauhan" for the Han dynasty). The importer links a row to an entity only if the QID is a polity whose name (or English Wikipedia article) and dates agree with the row, and lists every row it leaves unlinked in the changeset's rationale. One verified correction is applied: Q705904 (Seleucid dynasty) → Q93180 (Seleucid Empire).

## Wikidata dates for spans

Imported dates come from the entity JSON (with precision, calendar and qualifiers), not from SPARQL literals, which are astronomical and drop the precision. For the ends of a span: day, month and year precision are used as given; a decade becomes its stated year, approximate (`~`); a century or coarser is refused, leaving that end unknown (`-0303/`). Stand-alone dates (an event's point in time) may be centuries, which become intervals; millennia are refused (they turn "the Buddha" into `-0999/0000`). A `circa` qualifier (P1480 = Q5727902) marks the value approximate. Spans that end before they start, and lives that begin after a reign does, are skipped and reported.
