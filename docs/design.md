# Design

## Intent

A learning hub for history: first Indian history, later any subject, including current events. It is built on two commitments:

1. **Every statement is traceable** to the exact words it rests on, in a source a reader can open.
2. **Disagreement is data.** Competing readings, misconceptions and their corrections are stored and shown, not flattened into one voice.

The first user is the author, who is learning Indian history while building the platform. The MVP has to prove that learning from these pages works. Social features and public deployment come later.

**Anti-goals:**

- AI-written pages without per-claim sources (the Grokipedia failure).
- A single verdict machine that rules on contested history.
- Turning popularity into evidence.

## Architecture

```
            ┌──────────────┐     ┌──────────────┐
  browser → │  apps/web    │     │  apps/mcp    │ ← Claude Code (or any MCP client)
            │  Next.js     │     │  stdio       │
            └──────┬───────┘     └──────┬───────┘
                   └─────────┬──────────┘
                     packages/services      ← the only read/write path; every write audited
                    ┌────────┼──────────┐
           packages/core  packages/db  packages/connectors
           zod + logic    Drizzle/PG   Wikidata, Wikipedia, IA, DOI…
```

The rule: **the web app and the MCP server call the same services.** The UI and an agent perform identical operations, with identical validation and audit records.

## Data model (packages/db/src/schema.ts)

- **entities**: people, places, periods, polities, events, sites, inscriptions.
  - Aliases carry a language, a script and who uses the name.
  - `when` is an EDTF date with derived bounds.
  - `geo` is GeoJSON with a certainty.
  - Each can link to Wikidata.
  - `entity_links` hold typed relations: part_of, ruled, contemporary_of, and so on.
- **sources**: CSL-JSON records with tier (primary/secondary/tertiary), identifiers, licence, a `derived_from` chain (edition → work), and a composition date for works.
- **snapshots**: immutable captured texts, stored on disk by SHA-256 (written once, atomically) and verified whenever loaded from disk.
- **excerpts**: a quote and/or a locator, the snapshot it was checked against, W3C selectors into that snapshot, original-language text and a verification result.
- **claims**: a single proposition.
  - `kind`: fact, interpretation, misconception, debate or open question.
  - `assessment`: well supported … refuted; an editorial judgement, never a vote.
  - `themes`, `lenses` (historiographical school) and a date.
  - `found_via`: discovery provenance.
  - Optionally a learning prompt.
- **citations**: claim ↔ excerpt, with a stance and a support check.
- **claim_relations**: supports, contradicts, qualifies, context_for, corrects, same_as.
- **pages**: a list of typed blocks (prose with `claim:`/`entity:` links, key facts, claim lists, misconceptions, debates, quotes, visualisations, callouts), each optionally tagged with a theme. `page_revisions` keeps every version.
- **changesets**: proposed ops (refs resolved), their dry-run report, status and decision.
- **events**: an append-only audit log (a database trigger blocks UPDATE, DELETE and TRUNCATE). It records actor, on-behalf-of, session, action, subject, changeset and data.
- **notes**: answers posted by a study session, shown live beside a page. They are not content.
- **cards / review_logs / page_visits / learner_responses**: learning progress. Pages carry `guess` blocks ("Guess first", asked at a chapter's start and answered at its end) and `check` blocks (end-of-chapter recall, ordering and map questions), and misconception blocks ask "Did you believe this?"; see Learning in `docs/standards.md` for grading and scheduling.

JSONB columns are always validated by zod before they are written. The model will change as the platform grows; Drizzle migrations are the path for that.

## Changing content: propose → dry run → review → apply

1. An actor (an agent via MCP, or a person) submits a **changeset**: typed ops (`packages/core/src/ops.ts`).
   - Create ops may declare `ref: "name"`.
   - Later ops refer to it as `@name`, including inside Markdown (`[the war](claim:@kalinga)`).
   - Entities and pages may also be referenced by slug.
2. On proposal, the service:
   - validates the ops;
   - assigns UUIDv7 ids;
   - resolves refs, including refs from pending changesets the new one `dependsOn`;
   - runs the whole chain inside a transaction, then rolls it back.

   The **dry-run report** lists every outcome, each quote check, and lint issues per claim. The proposer sees problems immediately.

   Update ops carry the version of the object they were checked against (`baseVersion`), so an edit made against an older version fails instead of overwriting a later change. Page edits should use **`patch_page`** instead of `update_page`: it names only the blocks it removes, replaces, inserts or moves, and the spec keys it sets, each guarded by a fingerprint of that block or key as the proposer saw it (`blockFingerprint`, `packages/core/src/pagepatch.ts`). Two pending patches of one page conflict only if they touch the same block, so they can be approved in any order. An insert whose block is already there with the same content does nothing. Scripts build a patch by diffing the page's current blocks against the desired ones (`pagePatchFrom`).

3. A **human** approves (only a human can) or rejects with a note. Approval re-runs the same ops for real, each op in its own savepoint, so a failure names the op responsible.
4. Per-object events are attributed to the changeset's author (the agent acting for the user). The approval event is attributed to the approver.

**Checks** are metadata about content, not content, so they are recorded directly, with an audit event:

- re-running a quote check;
- a person attesting a quote;
- support judgements, where agents can produce only `ai_*` verdicts and people produce `human_*`, on one citation (`citations.support_check`) or on a claim's citations read together (`claims.support_check`).

## The verification ladder (packages/core/src/verification.ts)

| Level | Meaning                                                                      |
| ----- | ---------------------------------------------------------------------------- |
| L0    | no source                                                                    |
| L1    | cited, quote not checked (or cited by location only)                         |
| L2    | quote found in the stored snapshot (exact or fuzzy), or attested by a person |
| L3    | an AI reviewer judged that the excerpt supports the claim, or that the claim's excerpts support it together |
| L4    | a person confirmed it                                                        |

A claim's level is the best level among its evidential (non-"mentions") citations, or its joint support check if that is higher. It measures how well the _sourcing_ has been checked, not whether the claim is true. Truth is the separate `assessment`.

A support check on a citation says whether that one excerpt carries the claim: supports, partial or unsupported. For a qualifying or contradicting citation, "supports" means the stance is right. Each check records what it was made against (`SupportCheckBasis`): a hash of the claim text, the excerpt, a hash of its quote, and the stance. If any of these changes, the check is stale. It is still shown, as "no longer applies", but it counts as unchecked until it is judged again. Checks recorded before bases were kept count as current. Compound claims (a date, an event and a number, each from a different excerpt) leave every citation honestly partial. So a claim can also have a **joint support check** (`ClaimSupportCheck`, MCP `check_claim_support`): a verdict on named citations read together, with a note on which citation carries which part. It counts towards the level only when:

- the verdict is supports (L3 from an agent, L4 only from a person);
- every named citation is evidential, not rejected by a person, and has its quote verified (L2);
- it is current. The check records a hash of the claim text and the claim's full set of citations. If either changes, the check is stale: it is still shown, but it no longer counts until it is judged again.

An agent cannot replace a person's joint judgment while it is current. Splitting a compound claim into atomic claims is still better where the parts stand on their own.

**Lint rules** are cheap and deterministic. They are shown to reviewers and readers, and they never block:

- no sources;
- well-supported but fewer than two independent verified supporting sources (sources derived from the same work count once);
- supported only by tertiary sources;
- a quote not found;
- a fuzzy match below 95%;
- a misconception with no correcting claim.

## Quote matching (packages/core/src/text.ts)

Both texts are normalised:

- NFKD with combining marks removed (OCR drops IAST diacritics);
- lowercased, with punctuation removed and whitespace collapsed;
- line-break hyphenation joined (`-`, soft hyphen, `¬`).

An index map keeps offsets into the original text.

Matching runs in two passes:

1. Exact substring on the normalised strings.
2. Otherwise, approximate substring matching (Sellers' algorithm), seeded by the quote's _rarest_ words, accepted at a score of 0.88 or above.

The match yields W3C TextQuote and TextPosition selectors. In the seed, 34 of 34 quotes from 1877–1925 OCR scans verified: 20 exact and 14 fuzzy.

## Agents and MCP (apps/mcp)

One MCP session is one agent session. Every call is attributed to `PRAMANA_AGENT_HANDLE` acting for `PRAMANA_USER_HANDLE`, with the session id and the client's self-reported name.

Two transports serve the same server (`apps/mcp/src/server.ts`: tools, prompts, manual):

- **stdio** (`apps/mcp/src/main.ts`): the client starts the process; one process is one session.
- **Streamable HTTP** at `/api/mcp` in the web app (`apps/mcp/src/http.ts`): one session per `Mcp-Session-Id`, held in memory. Only this computer may connect: Host and Origin must be local (DNS-rebinding protection), and every request needs `Authorization: Bearer <token>`. The token is in `data/mcp-token` (or `PRAMANA_MCP_TOKEN_FILE`), mode 0600, and is shown and replaced on `/connect` (`services/local-access.ts`). `/connect` itself never shows the token to a non-local Host.

**Presence:** each call touches its session (`last_seen_at`, at most every 15 s); a session counts as connected while it was active in the last 10 minutes and has not ended (stdio exit, HTTP DELETE). The `sessions` trigger pushes changes over `/api/events`, which drives the top bar's presence glyph and `/connect`.

**Notes on any subject:** a note is about a page (or one chapter of it), an entity, a claim, a source, a canvas, or nothing in particular (`notes.subject_type`, `subject_id`), and may also name the page being read. Notes show live beside their subject (`components/ai/LiveNotes.tsx`); `/notes` is the history (filter, pin, archive). MCP prompts (`explain_claim`, `explain_chapter`, …) carry the same text as the web's "Ask your AI about this" button (`core/ask.ts`).

The tools cover:

- **reading**: overview, search, get_page as Markdown with ids, get_claim with lineage, entities, sources, timeline;
- **proposing**: `propose_changes`, `propose_page_patch`, withdraw;
- **evidence**: capture snapshots from Internet Archive, Wikipedia, URLs or pasted text; find and read in a snapshot; re-verify; judge support;
- **co-learning**: `post_note` about any subject with a Vega-Lite, timeline, map, table or lineage visual, `list_notes`, `archive_note`, `session_info`, plus due reviews, recording reviews, deck and progress;
- **open sources**: Wikidata, Wikipedia (outline, or a section with its citations), Internet Archive search, DOI/ISBN resolution.

The server's `instructions` hold the agent's manual (`apps/mcp/src/guide.ts`). AI cost sits with the user's own client; the platform runs no model.

**Visualisations are data, not code.** An agent emits a spec, the app validates it, stores it and renders it. Vega-Lite specs have remote URLs stripped.

## Web (apps/web)

Server components read through services, and server actions write as the local human.

**Live updates:** Postgres `NOTIFY` (triggers on `notes`, `changesets` and `sessions`) → `/api/events` SSE → client refresh.

**Visual system:** `docs/visual.md` is the system; this is the summary. Tokens live in `apps/web/app/globals.css`, light and dark (the dark ground is ink-blue, not black). Colour carries meaning and nothing else gets one: indigo = evidence and time; sandstone = places; turmeric = contested or a belief under examination; madder = refuted; sage (green) = confirmed by a person. The AI gets no colour: it is drawn in ink with a dotted rule. Type: Tiro Devanagari Sanskrit (display, reading, dates and Devanagari in one face), Inter (interface), Noto Sans Brahmi (the wordmark); every IAST mark is a designed glyph. Evidence sits in a recessed *field*; claims and prose stand on the page; a box means a whole-tile link, a field, or something that floats. UI kit: Tailwind v4 + shadcn/ui on Base UI, lucide icons; import `cn` from `@/lib/utils`. Layout: one fluid `Frame` (`components/shell/Frame.tsx`) that grows to 1880px; wide screens fill with content columns, the reading column keeps its measure. Phones: a 48px top bar, the bottom bar, evidence in a bottom sheet; PWA-ready shell with offline study (below). Signature elements: the **evidence seal** (four cells filled to the verification level, plus a glyph for the kind of source) and **the line is time**.

**The line is time:** one horizontal rule runs through the product. On the home it is the *age band* (`components/home/AgesExplorer.tsx`): every age on one stretched line (written ages hold a label-width bar) with the year cursor and the learner's progress under each age, above the full-width atlas. On era and entity pages it is the *age line* (`components/time/AgeLine.tsx`): a slim rule at the head with every age as a segment, the page's own age lit and named ("Maurya Empire, c. 322–185 BCE, age 5 of 16", linking to the list of ages), an ink cursor at the subject's dates; a live island (`AgeLineLive.tsx`) lets the cursor follow the atlas's year and the lit segment set it. On phones a compact line comes first. Nothing moves because the reader scrolled.

**Home** (`app/page.tsx`): a two-line head beside the *Continue* block (the age the learner is in, one progress bar, two buttons: the one place that says "you are here"); the age band and the atlas with the age at the current year beside it; "Pages to read" as image-led tiles of every written age in time order, each with a picture from inside its page and the learner's progress; the AI's latest notes; recent changes.

**Era pages** (`components/era/`): orient before you assert. The age line, the display title with Devanagari, the dates, the lede with the lead picture beside it. Then three columns that each look like what they are (docs/visual.md §4): the *contents* (a thin thread of part titles, only the part being read in ink), the *reading* (the only column in the serif), and the *bench* (`Bench.tsx`: cut into the page's right edge from the top bar to the footer, never scrolling). The bench holds the atlas (the map, with a slim year scrubber under it) and then one pane at a time, by tabs: "This part" (who took part and words to know), "Timeline" (the period's people and events, with the map's year as a line) and "From your AI". A part opens on the *part line* (the period's line with the part's years lit), then its title and one row of tags, its "Guess first" in a field, its one-minute *summary* in two forms (what happened as a large serif statement on the page, how we know in a field under it; the summary steps aside only while the learner is answering the guess), its "Check yourself" as one line, a picture beside the summary on wide screens, and "Read the whole part" to open it; the reader can also skim or open every part from the head. Labels follow the reader as they scroll (the contents' marker, "You are in Part n" in the bench, with "Show its map" to move the map to the part's year); the map and the panes themselves change only when asked. Selecting a claim opens the evidence drawer over the pane. Content uses `chapter`, `already_know` and `meanwhile` blocks; glossary words are entities of kind `term`. "Your view" panel keys are unchanged: `atlas`, `in_this_part` and `notes` hide the map and the two tabs, `railOrder` orders the tabs (the map stays on top), and `timeline` still adds or hides the standalone period timeline on pages without an atlas.

**Theme pages** (page kind `theme`, the same reader): one subject followed through the ages, with or without an entity. The age line lights every age its `tracks` block names, and the head gives the span of those ages instead of one date. A `tracks` block (`components/era/Tracks.tsx`) is a grid of facets by ages: it is drawn whole and small as *the weave* (a mark for every cell: written, with a quotation, or not yet written), and read one thread at a time, either one facet across every age or one age across every facet, turning from one to the other at any cell. Cell sentences link claims into the evidence drawer; a cell's quotation is shown as a voice in a field. Any page with claims has a bench, since that is where evidence opens on wide screens.

**Entity pages** (`components/entity/EntityPage.tsx`): answer first. The age line, a kind kicker, the title with Devanagari, the span, the portrait; one sentence on why the subject matters (its line from an era page's "Names you'll meet"), an evidence summary ("20 claims: 18 from sources of the time, 1 contested or weakly supported", linked); "Life and reign" bars; claims as rows in the order of the subject's life with the evidence drawer; the rail with the atlas, a picture strip and connections.

**The AI partner** (`components/ai/`; docs/visual.md §7): a reader's companion, not a chat. It appears as *presence* (the two-ring glyph in the top bar, filled indigo when an AI session is connected, "AI" beside it; a dot in the phone bar), which opens the *partner popover*: connected or how to connect, the last notes about what is in view, the "Ask your AI" prompts for the page, and Undo or Keep for a change the AI made to the learner's view. As *marginalia*: notes on any subject appear live beside their subject (sans, ink, a dotted rule; `/notes` is the history). As *asking*: "Ask your AI about this" copies a prepared prompt naming the thing by id, once per page head and once per claim in the drawer. `/connect` sets it up: a one-click Claude Desktop extension (`.mcpb`, built from `apps/mcp/src/extension.ts`, carrying the HTTP MCP address and the token), copy-ready configs for other clients, the token masked with a copy button, "Check Pramāṇa is ready", and the recent sessions. Changes arrive over the live stream, so nothing polls.

**Timelines** (`components/time/`): one engine (`lanes.tsx`, `useTimeWindow.ts`, `lib/time.ts`) behind `PeriodTimeline` (opens on a period; zoom out, zoom in, "Back to …"), `MasterTimeline` (home and /timeline, with layers: ages, rulers and people, events, places, when we learned it; stretched or true scale), `TimeRuleBand`, `WhereInTime` and `TimeStrip`. Astronomical years throughout; fuzzy ends fade, traditional dates are dotted, single years are dots; labels are measured and never overlap. EDTF unknown ends (`-0249/`) are drawn as uncertain, never as running to the present; only open ends (`/..`) do.

**Maps** (`components/map/`): our own basemap style (`style.ts`): OpenFreeMap vector tiles for land and water, hillshading from open terrain tiles, Natural Earth relief, and Natural Earth rivers, seas and physical regions clipped to South Asia (`public/geo`, built by `scripts/geo/build-basemap-data.ts`). Present-day cities and borders are an optional faint layer. Historical borders come from Cliopatria (CC BY 4.0) via `/api/extents?year=`, drawn dashed because they are reconstructions; `HistoryMap` adds a year slider. Every map also draws all other known places faintly, so zooming out shows the wider world. Desktop maps zoom with the plain wheel; touch keeps two-finger gestures.

## Not yet (deliberately)

- Authentication, multiple users and the social layer: arguments, contributions by others, reputation. Everything personal (canvases, views, notes, progress) is already scoped to one learner, so this is additive.
- The platform running a model of its own, or a chat: the AI is the learner's own client over MCP, and its words are never site content until a person approves them.
- Automatic detection of independence between sources, and monitoring of upstream Wikipedia changes for re-review.
- Meaning-based search (pgvector; search folds ASCII spellings but is lexical), and PostGIS for spatial queries. Geometry is JSONB for now.
- Public data dumps and a PROV/ClaimReview export.
- More visual types: argument maps, and evidence by discipline. Canvases hold the existing kinds (claims, entities, parts, quotations, pictures, maps, timelines, notes, charts, text).
- Browser tests in CI. Unit tests cover the logic most likely to be subtly wrong (dates, quote matching, ref resolution, canvas layout, views); the browser checks (`scripts/check-atlas.ts`, `scripts/check-canvas.ts`, `scripts/axe.ts`, `scripts/screenshot.ts`) are run by hand against a test server.

## Time spans and historical extents

**Spans.** An entity's `when` is its _primary_ date: it sorts the entity and is drawn by default. `entities.spans` (JSONB, validated by `EntitySpan` in `packages/core/src/spans.ts`) adds labelled spans: `life`, `reign`, `floruit`, `existence`, `construction`, `activity`, each with a `basis` and an optional `source` (a Wikidata QID and property, or a source id).

- `create_entity` / `update_entity` accept `spans`. Without a `when`, the primary date is taken from the spans by kind (`primarySpan`): persons prefer reign, then life; polities and periods existence; sites and inscriptions construction.
- Existing rows are not rewritten. A polity, period, culture, group or institution with no stored spans shows its `when` as an implicit `existence` span; a person's `when` is ambiguous (life or reign), so it gets none.
- Timelines choose a span per kind (`TimelineRoles`, e.g. `{ person: ["life"] }`). The default draws rulers by reign; when the curated `when` is the same span (both ends within five years), the curated date is drawn. `timelineLayers` returns one lane per role.

**Extents.** The `extents` table holds a polity's territory over an inclusive range of astronomical years: a GeoJSON MultiPolygon (validated by `MultiPolygonGeometry`), its bounding box (for filtering without PostGIS), the dataset and its row identifiers, a certainty (`reconstruction` for mapped datasets), the SPDX licence and the attribution text. Ops: `create_extent`, `update_extent` (with `baseVersion`). Reads: `extentsAt(year, bbox?)`, `extentsForEntity(ref)`, `mapLayers` (map features plus the extents of the map's polities); MCP: `extents_at`, `entity_extents`.

**Importers** (`scripts/import/`) propose changesets through MCP, like the seed:

- `wikidata-entities.ts`: entities from a declarative list (or SPARQL), with reign (P39 + P580/P582), life (P569/P570), existence (P571/P576) and event spans, coordinates (P625), and only the links Wikidata states. Coarse or contradictory dates are skipped and listed in the rationale. Existing entities are matched by QID (`entities_by_wikidata`, which also sees pending changesets) and enriched rather than duplicated.
- `cliopatria.ts`: Cliopatria borders clipped to 55–100°E, 0–42°N, simplified (Douglas–Peucker, tolerance per era so the busiest year stays under 60 KB), one changeset per era. A row's Wikidata QID links it to an entity only if the item is a polity whose name and dates agree with the row; unmatched major polities mostly inside South Asia get proposed entities.

Geometry helpers (clipping, simplification, point-in-polygon, area) are in `packages/core/src/geo.ts`, with no dependencies.

## Media (images)

Pictures are real files from Wikimedia Commons, never typed from memory. `media` rows (validated by `packages/core/src/media.ts`) hold the file fields read from the Commons API (URLs, size, MIME, SHA-1, licence, author, source line, credit line) and our editorial fields (title, alt text, `representation`, an optional note, the object's own date, `depicts` entity ids, a crop focus).

- **Licences:** only public domain, CC0, CC BY and CC BY-SA (any version or port) are representable; `classifyCommonsLicense` refuses NC, ND, fair use, GFDL-only and anything unrecognised. Public-domain photographs must also be free in the US: seed scripts require a PD-US, PD-1996 or PD-old-100 tag, or a stated reason.
- **Provenance:** capturing a file stores the API's page object as a snapshot (origin `commons`, content-addressed). `create_media` / `update_media` must name it, and apply re-parses it and refuses a record whose licence, author, URLs or size differ, or whose credit line omits a required author or licence.
- **Honesty:** `representation` says what the picture is: a photograph of the object or site, a photograph taken at the time, a picture made at the time, a later copy, a later imagining, a historical or modern map, a diagram. Imaginings carry a "Not a likeness" tag wherever they appear.
- **Blocks:** `figure` {media, caption (Markdown, claim links), size} and `gallery` {items [{media, caption}], 2–8}; `spec.hero.media` is the lead image. `PageView.media` carries the cards; `EntityCard.image` is the best picture depicting the entity (evidence first, imaginings last).
- **Delivery:** plain `<img>` with a `srcset` of Commons' standard thumbnail widths (`COMMONS_THUMB_WIDTHS`; other widths are refused by Wikimedia), so images come straight from Wikimedia's CDN. Components: `components/media/` (`Figure`, `Gallery`, `HeroImage`, `EntityThumb`, `MediaDialog`).
- **Tools:** MCP `search_commons`, `commons_files`, `wikidata_images`, `propose_media`, `media_by_file`, `list_media`, `get_media`; seed scripts `scripts/seed/media-*.ts`.

## Insights and privacy

`/insights` (and MCP `get_insights`, from `packages/services/src/insights.ts`) makes the platform's patterns public: how well the content is sourced (claims by verification level and source tier, page by page; quote checks; claims resting only on reference works; chapters where at least a third of the claims are thin; sources by tier, kind and licence), who changes it (changesets by the kind of actor who proposed and decided them, and edits by month, from the changesets and the audit log), and how learners answer (prior beliefs in misconceptions, first-guess accuracy, answers given as "sure" that were wrong, the claims most often forgotten).

Learning figures follow one privacy rule (`aggregate` in `packages/core/src/privacy.ts`): **only aggregates, and only from at least `MIN_GROUP` (5) distinct learners.** Below that, the value is withheld and only the number of answers and of learners is shown, so a share cannot be read back to one person. Per-person answers are never published or returned by the tool. Each learner counts once per question (their latest belief, their first guess). Test accounts (handles starting `test-`) are left out. Content and change statistics are about public content, so they are shown exactly.

## Offline study (PWA)

The app is installable (`app/manifest.ts`) and studies offline. Nothing else works offline, by design.

- **Service worker** (`apps/web/public/sw.js`, registered from /learn with scope `/`): keeps `/learn` and the home page network-first, `GET /api/study/due` network-first, and the static assets the kept pages need (`/_next/static`, icons, manifest; cache-first in production, network-first in development). It never touches anything that is not a GET (answers, server actions), `/review`, `/audit`, other `/api` routes, React Server Component requests or the live-update stream. Other pages opened offline get a short "You are offline" page pointing to Learn. No push, no background sync, no other origins.
- **Cards for the next days**: `GET /api/study/due?days=3` returns the cards due now and over the next three days. The page keeps the last copy in IndexedDB (`components/learn/offline.ts`). Opened offline, the session shows the cards from that copy that are due by now and were not already answered on the device.
- **Answers are queued**: every review answer goes into an IndexedDB queue with an idempotency key (UUIDv7) and the time it was given, then is sent to `POST /api/study/reviews` (same-origin JSON only). The page sends the queue again on load and whenever the browser comes back online. The server (`recordQueuedReviews`) records each key once (`review_logs.client_key`, unique per learner), schedules FSRS from the time of answering (never before the card's last review), keeps that time in the review log, and writes the audit event with `answeredAt`, `clientKey`, `via: "queued"` and `syncedLater` (true when the answer reached the server more than a minute after it was given). Answers older than 30 days, or dated in the future, are refused.
- **What the learner sees**: a quiet line in the study card, "Offline: your answers are kept on this device and will sync when you are back online", with the number waiting.
- **Checked by** `scripts/learn-offline-check.ts <url>` (Playwright, against a server running as a test learner): service worker control, answers queued offline and sent when back online, a replayed key recorded once, /learn reloaded offline and studied from the device's copy. In `next dev` a page reloaded offline does not hydrate (the dev client needs its hot-reload connection), so that step passes only on a production build (`next build && next start`); the rest works the same in development.

## Canvases and "your view" (personal workspace)

Both belong to one learner and are not site content: no changesets, but every write goes through the services (`canvas.ts`, `userviews.ts`), the JSONB is validated by zod in core (`canvas.ts`, `userview.ts`), it is limited to its owner (the human, or the human an agent acts for), and it is recorded as an audit event (`canvas.*`, `view.*`; excluded from the content cache's version). An event's subject is the canvas or the view row, never the page, entity or claim, so personal activity stays out of public histories.

**Canvases** (`/canvas`, `/canvas/[id]`; tables `canvases`, `canvas_items`, `canvas_links`):

- Items are references rendered live: a claim (with its seal and sources), an entity, a part of an era page (short version or in full), a quotation, a picture (`MediaTile`), a map of a year and a timeline (the atlas's `MapEmbed`/`TimelineEmbed`, sharing the year on one board), a study note, a chart (`VizSpec`), the learner's text, and sections. Each may carry a title and a note. A reference to deleted content says so and can be removed. Claim and quotation items keep the words as placed; when the source changes the tile says "Updated since you placed this", with the difference, until the learner takes the current wording.
- Layout is a grid of cells (96 × 48 px, `CanvasLayout`). Items keep the place they were given; one dropped on others pushes them down (`settle`, `moveItem`); "Tidy up" closes gaps; `flowLayout` lays items out in an order (the AI's `canvas_arrange`). Lines between items carry a relation: supports, contradicts, causes, precedes, same as, questions, related.
- The board is React Flow (MIT) with our tiles under one thin floating toolbar: drag by the header, resize, pan and zoom (titles only when far out; opening fits every tile in view), link items from a tile's menu ("Link to another item": pick the item, then the relation) or by dragging a tile's edge onto another, arrow keys to move a focused tile and Shift+arrows to resize, "/" or Cmd-K to search and insert (site results first). The AI's notes about the canvas float at the right as marginalia. Phones get the items as a list in reading order with their lines listed under each; the board is read-only there until "Edit layout". An empty canvas offers "Add something", the "/" shortcut and three starting ideas.
- What the learner's AI adds (MCP `canvas_*`) arrives pending: a dotted ink edge, "added by your AI", Keep or Remove, and "Keep all" or "Take back" per batch. Only the person decides. Changes appear live (NOTIFY on `canvases`).
- "Add to canvas" (`components/canvas/AddToCanvas.tsx`) sits wherever a thing appears; it marks the canvases that already hold it.

**Your view** (table `user_views`, `components/yourview/`): a learner's arrangement of an era or entity page, laid over the page's spec in the browser (`applyUserView`); the page and its spec are never changed. It can hide or show panels, reorder the rail, leave turning points off the map or add the learner's own, open the map on a year and with today's names, open the page on the short versions or in full, keep parts already read folded, bring out names (chips get a ring; polities are drawn strong), mark claims to remember or come back to, and hold the learner's notes and study notes pinned to a part. "Customise this page" offers a few fixed choices and "Put the page back as published". Every change keeps the view before it, so any change can be undone; an AI's change (MCP `view_set`, with a reason) is announced in place as one line, "Your AI changed this view. Undo", with the reason and Keep in the partner popover. An AI may bring things forward but may not hide claims (`LEARNER_ONLY_HIDE`). "Customise this page" docks beside the content on wide screens and is a half-height sheet on phones, so the page shows each change as it is made.

**The appearance view** (subject `site`, one row per learner, `SITE_VIEW_ID`): the appearance panel's choices (text size, line width, evidence density, theme; `Appearance` in `packages/core/src/appearance.ts`) are the learner's site-wide view, so they follow the learner to any device; a cookie and localStorage mirror them so the server sets `data-text`, `data-width` and `data-density` on `<html>` before paint. The learner's AI may set them (`view_set` with subject `site`); the panel follows live and offers Undo. Changing the text size keeps the reader's place.

**Demos and checks:** `scripts/demo/asoka-canvas.ts` builds "Aśoka in context" in preview through MCP from existing content; `scripts/demo/tailor-view.ts` tailors the Maurya page as an AI would (`--undo` takes it back); `scripts/check-canvas.ts <id>` renders the board at three widths in both themes and checks that a drag and a keyboard move are saved.
