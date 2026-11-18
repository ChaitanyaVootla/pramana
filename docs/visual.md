# Visual system

How Pramāṇa looks and why. `docs/design.md` says what the product is; this says how it appears. Tokens live in
`apps/web/app/globals.css`; the shell in `apps/web/components/shell/`; primitives in `apps/web/components/ui/`.
Every page owner restyles their pages from this guide. When this guide and a page disagree, the guide wins; when
the guide is silent, choose the quieter option and write the choice down here.

## 1. Point of view

The subject is written evidence: letters cut into rock and copper, manuscripts on palm leaf and paper, maps drawn
and redrawn. The interface borrows from how that material is read, not from how it is decorated.

- **Incised, not boxed.** An edict is text cut into a surface. Evidence (quotations, scanned text, the chain from a
  claim to its source) sits in a *field*: a slightly recessed, darker area with a fine inner edge. Claims and prose
  stand on the page itself. The page is paper; evidence is cut into it. Nothing floats unless it really floats
  (menus, the search, the evidence drawer).
- **One voice for two scripts.** Titles, dates and reading text use Tiro Devanagari Sanskrit, a family whose Latin
  was drawn for romanised Sanskrit beside its Devanagari. "Maurya Empire मौर्य राजवंश" is one line in one face, not
  a serif with a guest. Every IAST mark (ā ī ū ṛ ṝ ḷ ṅ ñ ṭ ḍ ṇ ś ṣ ḥ ṃ) is a designed glyph, never a fallback.
- **The line is time.** One horizontal rule runs through the product: the age band on the home page, and the same
  band carried into every era and entity page as the *age line* (`components/time/AgeLine.tsx`): one slim rule at
  the head with every age as a segment on the stretched scale (written ages indigo, the rest tinted, a learner's
  way through an age as a hairline), the page's own age lit and named, and an ink cursor at the subject's date.
  Each segment links to its page; the rule itself links back to the home band. On phones the compact line comes
  first on the home page and on each page head. It never moves with the scroll. Horizontal bars in indigo are
  always years. Nothing else may be a horizontal indigo bar.
- **Colour is meaning.** Indigo is evidence and time; sandstone is place; turmeric is contested or a belief under
  examination; madder is refuted; sage is a person's confirmation. Nothing decorative gets a colour. The partner AI
  gets no colour of its own: it is drawn in ink with a *dotted* edge, the same mark the timelines use for a
  traditional date, because an AI's words are not yet evidence.
- **Dense where the reader is deciding, open where the reader is reading.** Wide screens fill with columns of
  real content (map, timeline, pictures, evidence), never with margins. The reading column alone keeps air.
- **Pictures are evidence too.** Every image carries what it is (a photograph of the object; a later imagining)
  and its credit, in the same quiet type as a citation.

Boldness is spent in one place: **the home page opens on the subject itself**, a full-width atlas with the age
band as its spine. There is no marketing hero. Everywhere else the system is calm.

### Checked against the usual tells

| Tell                                           | Where we stood                            | Decision                                                            |
| ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Cream paper, serif, terracotta accent          | Cool grey ground, Literata, indigo accent  | Ground is lime-white (neutral, not yellow); accent stays indigo.    |
| Dark theme with one acid accent                | Near-black with light indigo               | Dark ground is ink-blue, not black; the meaning colours stay a set. |
| Hairline-rule broadsheet                       | Not present                               | Rules separate list rows only; sections separate by space.          |
| Identical rounded cards with soft grey shadows | Everywhere (132 uses of `.card`)          | Boxes only for a whole-tile link or a floating layer; see §5.        |
| ALL-CAPS eyebrows                              | None                                      | Keep none. Kickers are sentence case, sans, ink-2.                   |
| Middle-dot meta strings                        | Common ("54 parts read · 21 skimmed")      | Separate with commas, or with space on a grid; never `·`.            |
| Arrows on links                                | Common ("Read in context →")               | None. A link is text, underlined on hover. Chevrons only on folds; the small ↗ glyph only on a link that leaves the site (a source, Wikidata). |
| Pill chips everywhere                          | Dates, places, people on every part        | Chips are 4px-radius tags; at most one row per heading; see §5.     |

## 2. Tokens

### Colour

Six named colours per theme carry every meaning. Tints and washes are derived from them with `color-mix`; the
derived values are frozen in `globals.css` (so contrast is known), named after their base.

| Token         | Light     | Dark      | Meaning                                                  |
| ------------- | --------- | --------- | -------------------------------------------------------- |
| `--chuna`     | `#f3f2ee` | `#0f1015` | The ground (lime-white; ink-blue at night).              |
| `--paper`     | `#fdfdfb` | `#171821` | The reading surface and tiles.                           |
| `--ink`       | `#17181d` | `#edece6` | Text. `--ink-2` and `--ink-3` are its two quieter steps. |
| `--indigo`    | `#2e3eb8` | `#9ba7ff` | Evidence and time: links, dates, the seal, the band.     |
| `--sandstone` | `#a65f27` | `#e0a470` | Places (Chunar sandstone, the stone of the pillars).     |
| `--turmeric`  | `#c08a00` | `#e7b847` | Contested; a belief under examination.                   |
| `--madder`    | `#b8362b` | `#f28c82` | Refuted.                                                 |
| `--sage`      | `#257346` | `#7ecf9b` | Confirmed by a person. Green is reserved for people.     |

Surfaces: `--chuna` (ground), `--paper` (surface), `--field` (incised: `#ecebe5` / `#1d1e29`), `--rule` (edges:
`#dddcd4` / `#2a2b37`). Text on any of the three surfaces: `--ink` ≥ 14:1, `--ink-2` ≥ 6.8:1, `--ink-3` ≥ 4.5:1.
For coloured *text* use the `-ink` variant (`--turmeric-ink`, `--sandstone-ink`); the base colour is for marks and
fills. Washes (`--indigo-wash` …) are backgrounds for text in the same colour's `-ink`. The time band (`--band-*`)
stays deep indigo in both themes. Filled primary controls in the dark theme use `--primary` (`#5262e3`), not the
light link indigo.

### Type

Three families, loaded with `next/font` in `apps/web/app/layout.tsx`:

- **Tiro Devanagari Sanskrit** (`--font-serif`, `--font-heading`, `--font-deva`): display, reading, dates,
  Devanagari. One weight, with italics. Emphasis in prose is italic; `strong` is set in the sans at 600 so no weight
  is synthesised.
- **Inter** (`--font-sans`): interface text, labels, numbers (`tnum` for columns), captions.
- **Noto Sans Brahmi** (`--font-brahmi`): the wordmark only.

Roles and the Tailwind classes that set them (sizes in px, line-height):

| Role      | Class       | Size/leading | Face  | Use                                                             |
| --------- | ----------- | ------------ | ----- | --------------------------------------------------------------- |
| Display   | `text-4xl`  | 44 / 1.02    | serif | The one title on a page (era, entity). `text-5xl` (56) on home. |
| Title     | `text-3xl`  | 32 / 1.08    | serif | Section titles that open a page region.                         |
| Heading   | `text-2xl`  | 24 / 1.15    | serif | Part and chapter headings.                                      |
| Subhead   | `text-xl`   | 20 / 1.3     | serif | Rail headings, tile titles.                                     |
| Lede      | `text-lg`   | 19 / 1.5     | serif | The one-paragraph lede under a title.                           |
| Reading   | `text-base` | 17 / 1.6     | serif | Prose. Measure 62–66ch.                                         |
| Note      | `text-note` | 15 / 1.5     | sans  | Summaries, tile text, answers.                                  |
| UI        | `text-ui`   | 14 / 1.45    | sans  | Controls, navigation, rail text, list rows.                     |
| Small     | `text-sm`   | 13 / 1.45    | sans  | Meta lines, captions, credits.                                  |
| Micro     | `text-xs`   | 12 / 1.4     | sans  | Tick labels, chips, seals' words.                               |

Headings are weight 400 and tracked `-0.01em`; above 32px, `-0.02em`. Devanagari beside a Latin title is the same
size, `text-ink-2`, with `lang="hi"` (or `sa`), so screen readers switch language and the face stays Tiro.
Numbers in tables and timelines are tabular (`tnum`). Always import `cn` from `@/lib/utils`.

### Space, radius, elevation, motion

- **Space:** 4px grid. Within a component 4/8/12; between components 16/24; between sections 40 (`mt-10`), 48 on
  wide screens. Gutters are `--gutter` (16–48px fluid). The page frame (`--frame-max`) grows to 1880px.
- **Radius:** `--radius-sm` 4px for tags, seals, fields; `--radius-md` 6px for controls, rows and tiles;
  `--radius-lg` 10px for floating layers. Nothing is rounder, except circles (avatars, dots).
- **Elevation:** three levels. Ground (`chuna`) → surface (`paper`, edge `rule`, no shadow) → floating
  (`paper`, `--shadow-pop`). The *field* is the only thing below the surface: `--field` with
  `box-shadow: inset 0 1px 0 rgb(0 0 0 / .05)`. No other shadow exists.
- **Motion:** 150ms `--ease-out-quart` for colour and opacity; 200ms for position; sheets 320ms `--ease-sheet`.
  Nothing moves because the reader scrolled; maps and timelines move only from a reader's action (a click on a
  date, a drag, Play). `prefers-reduced-motion` turns all of it off.

## 3. Layout

- **Wide (≥1280):** every page is a grid of content columns with no empty column. The reading column is
  40–44rem; everything else (atlas, pictures, evidence, lists) takes the rest. At 1920 the frame is 1880px: a
  reading page is contents (13rem) | reading (44rem) | rail (the remainder, ≥ 27rem, which may itself split into
  map above and notes below). Lists and tiles go to 4 columns at ≥1536.
- **Medium (768–1279):** two columns: reading | rail (20rem). Tiles 2 across.
- **Narrow (<768):** one column. The top bar is 48px; sections are tighter (`mt-8`). The bottom bar carries Ages,
  Timeline, Search, Places, Learn. Evidence opens in a bottom sheet; maps are `inline`, 260–280px tall. Nothing is
  hidden on a phone that a desktop shows; it is folded.
- **PWA:** safe areas are honoured (`env(safe-area-inset-*)`); the chrome colour follows the ground; the bottom
  bar sits inside the home indicator.
- **Section rhythm:** a section is a heading (serif) with an optional aside on the same baseline (sans, ink-3),
  then content. No section is wrapped in a box.

## 4. Components

- **Top bar** (48px): wordmark with its Brāhmī form, sections, the review dot, search field, the AI presence,
  appearance. Solid ground, 1px rule. Sticky.
- **Panels that change the page** ("Customise this page", `components/yourview/Customise.tsx`) never cover
  the text they change: from 1680px the panel docks at the right and the page moves over for it
  (`html[data-dock]`; the frames make room, `--dock-w` 22rem); from 1024px it floats over the rail
  (`--shadow-pop`), the reading column still in view; below, it is a bottom sheet over the lower half only, with
  no backdrop and the page still live above it, so each change shows as it is made; its footer holds Undo and
  "Put the page back", always in reach (in the dock they sit at the top). Each option says what it does now
  ("The page already opens this way"). The page grids are viewport-based, which is why the push waits for room.
- **Appearance panel** (`components/shell/Appearance.tsx`): theme (device, light, dark), text size (small,
  standard, large), line width (standard, wide) and evidence density (quiet, standard, full). The choices are
  `data-text`, `data-width` and `data-density` on `<html>`; the tokens respond, pages do not read them. Text size
  scales the root em without losing the reader's place (the block at the top of the viewport is held in place
  across the reflow, with the browser's own scroll anchoring off for the change so the two never add up). Line width sets `--measure` (64ch → 80ch) and `--reading-w` (44rem → 58rem): a reading
  column is `max-width: var(--reading-w)`, prose `max-width: var(--measure)`. Density: mark citation detail
  that should go at *quiet* with `.evidence-standard` (the source line beside a claim) and detail that appears
  only at *full* with `.evidence-full` (quotations and checks in the text); seals always show. The choices
  (and the theme) are kept per learner as their *site-wide view* (`user_views`, subject `site`, core
  `Appearance`), so they follow the learner to any device; a cookie and localStorage mirror them so the
  server sets the attributes before paint. The learner's AI may change them over MCP (`view_set`, subject
  `site`); the panel follows live and says so, with Undo. Segmented choices (text size, how a page opens) use
  `Segments` (`components/ui/segments.tsx`): a recessed field with the chosen option raised to paper.
- **Empty states** are designed, never blank: `EmptyState` (`components/ui/empty-state.tsx`), a recessed field
  with one sentence saying what would be here (`title`), an optional second saying why or what fills it, and the
  one action that fills it (`action`: a Button, or a Link with `buttonVariants`). `size="sm"` in rails and lists.
  Examples: "No borders are known for this year" over the map (atlas); "No source captured yet" (reader);
  "Nothing to review" (review); "No notes yet" with "Connect your AI" (connect); "No cards due" (learn).
- **Bottom bar** (phones): five items, 44px targets, labels always shown.
- **Search** (⌘K): a floating dialog, `--radius-lg`, grouped results with meaning-coloured glyphs.
- **Buttons:** `default` (indigo fill, white), `outline` (paper, rule), `ghost`, `secondary` (indigo wash),
  `destructive` (madder wash), `link`. Height 36 (`sm` 32, `xs` 28, `lg` 44). Radius `md`. Sans 14 medium. An
  icon, when present, is 16px and leads.
- **Tags** (`Badge`): 4px radius, sans 12 medium, `h-5`. Variants by meaning: `evidence` (indigo), `place`
  (sandstone), `contested` (turmeric), `refuted` (madder), `person` (sage), `neutral`. Never a pill.
- **Fields** (`.field`): recessed evidence. Quotations, scanned text, the chain of evidence, a "Guess first" box.
  Padding 12–16; serif for quoted words; sans for the apparatus around them.
- **Tiles** (`.tile`): a whole-tile link. Picture (16:9 or 3:2, `object-cover`), then text on the surface; the
  tile's edge is `rule`, radius `md`; on hover the title turns indigo; no lift, no shadow.
- **Lists:** rows separated by `rule`, 40px minimum, sans 14; the leading column is the thing, the trailing
  column its date or count in `tnum` ink-3.
- **The evidence seal:** four cells filled to the level (indigo; sage at L4; dashed outline at L0) plus a glyph
  for the kind of source. It never changes size: 6×9px cells, 3px gap.
- **Chips on headings:** one row at most under a heading: date (indigo wash), places (sandstone wash), people
  (neutral). If there would be more than five, show four and "+n".
- **Images:** `CommonsImage` with sizes; credit in sans 12 ink-3 beneath or over a 40% ink gradient; the
  "Not a likeness" tag on imaginings. Dark theme dims images to 92%.
- **Devanagari:** always `lang` and `font-deva`; beside Latin at the same size; alone (a name list) as reading text.
- **Focus:** one indicator everywhere: 2px indigo outline, 2px offset.

## 5. Where boxes are allowed

A box (edge or background) means one of exactly three things: *this whole thing is one link* (a tile); *this is
cut into the page* (a field: evidence, a question); *this floats* (menu, dialog, drawer, sheet, toast). Everything
else is laid out with type, space and rules. In particular: rail blocks are heading + content; parts of an era are
heading + chips + prose + a field for the check; progress is a bar, not a card; a summary is a paragraph, not a card.

## 6. Pages

**Home** (`/`, flagship): a two-line head (title and one sentence) beside a dense "Continue" block (the age the
learner is in, one progress bar, two buttons), on the first screen. Then the *age band*: every age on one stretched
line with the year cursor, filled in as the learner begins, reads and remembers each age (this replaces the
separate "where you have been" strip); every written age keeps a bar at least as wide as its name, the rest giving
way. Then the atlas, full width, with the age at the current year described beside it, with its lead picture (no
box). Then "Pages to read": every written age as a *tile* in time order (1 across on a phone, 2 from 640px, 3
from 1024px, 4 from 1536px), image-led with a picture from *inside* its page (a figure; the lead picture only when
there is no other, since the atlas column already shows it), then its dates, title, one line of story, what it
holds and the learner's progress as a hairline. No age is singled out there: the Continue block is the one place
that says "you are here". Then the recent changes as a plain list.

**Era** (`/p/…`, reader): first the *age line* (§1) across the frame, this era lit and its span as the cursor; then
the display title with Devanagari, the dates line, the lede, and the lead picture as a
figure beside the lede at ≥1280 (not below). The hero's right column is the period timeline, the map, "You may
already know". Parts: "Part n of m" kicker, heading, one row of chips, prose on the page, the summary ("What
happened" / "How we know") as prose with a thin indigo left rule, the check in a *field*. No nested panels. Rail:
heading + content blocks; notes from the AI as marginalia (§7). The evidence drawer floats at `--radius-lg`.

**Entity** (`/e/…`): answer first. The *age line* (§1) across the frame, the age the subject belongs to lit and
the subject's own dates as the cursor; then a kind kicker, display title with Devanagari, the span line, the portrait as
a figure at the right of the head. Under the title, one sentence that says why this person or place matters
(the entity's description, written as an answer), then an *evidence summary* line in sans: "20 claims, 15 from
his own inscriptions, 2 contested" (counts from the claims' source tiers and assessments). "Life and reign" bars
under that. Claims as list rows (seal at the right) in the order of the subject's life, not by page part; the
page each comes from is the row's meta line. The rail: atlas, names, links.

**Side effects are announced.** When a click on a claim or a date moves the map or the timeline, the moved thing
says so in place: a one-line note over the map ("Map moved to 261 BCE", fades after 3 s) or the year chip
flashing once. The address bar may change (`?year=&pin=`), but the reader is told by the surface that changed.
Panels that scroll show it: a fading edge at the bottom and never a cut-off first line.

**Claim** (`/c/…`): the claim is the display title on the page. The chain of evidence is a *field*. The quotation
is serif in a field with a 2px indigo left rule; the scanned text is a field in serif with the match highlighted
by an indigo wash. The right column: where it stands (seal, assessment), context, related claims. No surface
card around the whole page.

**Source** (`/s/…`): bibliographic head in serif, then excerpts as fields.

**Learn** (`/learn`): the session is a single column of 40rem centred in a wider frame whose sides hold the deck
and the seal key as plain blocks; a question is a field; answers are outline buttons in a 2-column grid; progress
is a bar at the top of the column. "What you learned today" is a list of claim rows.

**Review** (`/review`): rows, not cards: title (serif 17), who and when (sans 13 ink-3), what changed (sans 13),
decision on the right as a tag (`person` sage when a person decided; `neutral` when the delegation did).

**Places** (`/places`): atlas full width, then places as list rows in 2–4 columns grouped by kind, each row
sandstone name, page links, date in tnum.

**Timeline** (`/timeline`): the atlas and the "map shows" block side by side; layer toggles as tags; the master
timeline full width.

**Connect** (`/connect`, connect): a short page in the reading column. The token is a *field* with a copy button.
Each client's config is a field with a tab row above (Claude Code, Claude Desktop, other). Connection state at
the top as a single sentence with the presence glyph (§7).

**Canvas** (`/canvas`, canvas): the ground is the canvas (chuna, dotted 16px grid in a third of `ink-3`; the rule
colour alone is lost on chuna). Items are *tiles* with a 6px radius, a kind kicker as the drag handle, and the
tile's edge darkening on hover; an item showing evidence renders as a field inside its tile. Items the AI added
and the learner has not kept have a dotted ink edge, as do their lines; a line's words sit at its midpoint as a
4px tag. One thin toolbar floats at the top left (`--radius-lg`): where the canvas sits and its title, what you
can add, the view, the study partner. Under it, when the AI has added items, one line with the partner's dotted
rule: "Your AI added n items", Keep all, Remove all. The AI's notes about the canvas float at the top right as
marginalia and can be folded from the toolbar. No sidebar. A line between two tiles runs between their facing
edges (never top to top over the headers); it is made from a tile's menu ("Link to another item": pick the item,
then the relation, in one dialog that also serves the phone list, where the lines are listed under each item), by
dragging a tile's edge dot onto another tile, or by the AI. Opening fits every tile in the room the chrome leaves,
never larger than life; under 40% zoom a tile shows its title alone. An empty canvas is a field in the middle of
the ground (the one empty state with a serif title, since it is the whole page) with "Add something", the "/"
shortcut and three starting ideas. On a phone the items are a list in reading order under the same toolbar, the
notes a fold.

## 7. The study partner

The AI is a reader's companion, not a chat. It appears in three ways and only these:

1. **Presence.** In the top bar, a 16px glyph: two concentric rings in ink. Connected: the inner ring is filled
   indigo and the title reads "Your AI is connected". Not connected: both rings dotted, title "Connect your AI".
   It links to `/connect`. On phones it sits in the bottom bar's Search item as a 6px dot.
2. **Marginalia.** A note from the AI appears in the context rail (or under the part on a phone) as *marginalia*:
   sans 14, ink, a dotted left rule in ink-3, the visual it posted inside a field, and a time in ink-3. Notes never
   interrupt reading; a new one fades in (200ms) where it belongs. A history of notes is a plain list.
3. **Asking.** "Ask your AI about this" is an outline button with the presence glyph that copies a prepared
   prompt. It appears once per page head and once per claim in the evidence drawer, never on every row.

Nothing bounces, blinks or greets. The partner has no avatar, no bubble, and no colour but ink and the dotted rule.
