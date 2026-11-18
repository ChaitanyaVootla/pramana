# Visual system

How Pramāṇa looks and why. `docs/design.md` says what the product is; this says how it appears. Tokens live in
`apps/web/app/globals.css`; the shell in `apps/web/components/shell/`; primitives in `apps/web/components/ui/`.
When this guide and a page disagree, the guide wins; when the guide is silent, choose the quieter option and write
the choice down here.

## 1. Point of view: dyed in indigo

The subject is Indian history read from its evidence. The look comes from two things in that world: the natural
dyes of Indian cloth (indigo, madder, turmeric), and the way an inscription is cut into its surface.

- **Indigo is the brand and the ink.** Text is a very dark indigo, never neutral black. The ground is cotton
  rinsed in blue (the way white cloth is whitened with neel), never cream and never grey. At night the page is the
  vat: indigo so deep it is nearly dark, never neutral black.
- **The slab.** Cloth dyed the other way round: deep indigo with white type. It is the top bar and the footer on
  every page, and the opening of the home page, where it runs on from the top bar as one field. Nothing else is a
  slab. Inside `.on-slab` the ordinary token names (`--ink`, `--rule`, `--paper`, `--primary` …) resolve to their
  on-indigo values, so any component can sit on it unchanged; never hand-pick white-with-opacity colours there.
- **Two voices.** *Anek* (Latin and Devanagari, one design) is the platform speaking: titles, navigation, labels,
  numbers. *Tiro Devanagari Sanskrit* is history speaking: prose, claims, quotations, questions put to the
  learner. A claim is always in the serif, even when it is the title of its page; the name of a page, a person or
  a place is always in Anek. If you are unsure which voice a piece of text is, ask who is speaking.
- **Incised, not boxed.** Evidence (quotations, scanned text, the chain from a claim to its source) sits in a
  *field*: a recessed area with a fine inner edge and nearly square corners. Claims and prose stand on the page
  itself. Nothing floats unless it really floats (menus, the search, the evidence drawer).
- **The line is time.** One horizontal rule runs through the product: the age band on the home page, and the same
  band carried into every era and entity page as the *age line* (`components/time/AgeLine.tsx`). Horizontal bars
  in indigo are always years.
- **The other dyes are meanings, never decoration.** Sandstone is place; turmeric is contested or a belief under
  examination (and something waiting for the learner's decision); madder is refuted; sage is a person's
  confirmation. The study partner (the AI) gets no colour of its own: it is drawn in ink with a *dotted* edge,
  the same mark the timelines use for a traditional date, because an AI's words are not yet evidence.
- **Pictures are evidence too.** Every image carries what it is (a photograph of the object; a later imagining)
  and its credit, in the same quiet type as a citation.

Boldness is spent in one place: **the home page's opening**, the slab with the promise set very large and one
real claim shown with the words it rests on. Everywhere else the system is calm.

### Checked against the usual tells

| Tell                                           | Decision                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Cream paper, serif display, terracotta accent  | Blued-white ground, a narrow sans for display, indigo throughout.        |
| Near-black dark theme with one acid accent     | The dark ground is indigo (`#0b0d24`); the meaning colours stay a set.   |
| Hairline-rule broadsheet                       | Rules separate list rows only; sections separate by space.               |
| Identical rounded cards with soft grey shadows | Boxes only for a whole-tile link, a field or a floating layer; see §5.   |
| ALL-CAPS eyebrows                              | None. A kicker, when needed, is sentence case, sans, `ink-3`.            |
| Middle-dot meta strings                        | Separate with commas, or with space on a grid; never `·`.                |
| Arrows on links                                | None. A link is text. Chevrons only on folds; ↗ only on a link that leaves the site. |
| One accented word in a headline                | Never. A headline is one colour and one weight.                          |
| Monospace for small data                       | Never. Numbers are Anek with tabular figures (`tnum`).                   |

## 2. Tokens

### Colour

| Token         | Light     | Dark      | Meaning                                                    |
| ------------- | --------- | --------- | ---------------------------------------------------------- |
| `--chuna`     | `#f2f4fa` | `#0b0d24` | The ground (blued cotton; the vat at night).               |
| `--paper`     | `#ffffff` | `#131638` | Tiles, controls, floating layers.                          |
| `--field`     | `#e7eaf5` | `#191d47` | Incised: evidence, a question, a segmented control.        |
| `--ink`       | `#14163a` | `#eceefb` | Text. `--ink-2` and `--ink-3` are its two quieter steps.   |
| `--rule`      | `#d3d8ea` | `#2a2f63` | Edges and row rules. `--rule-soft` for hover grounds.      |
| `--indigo`    | `#2733c4` | `#a5aeff` | Evidence and time: links, dates, the seal, the band.       |
| `--slab`      | `#151b66` | `#191f70` | The top bar, the footer, the home opening.                 |
| `--sandstone` | `#a85a22` | `#e3a672` | Places.                                                    |
| `--turmeric`  | `#c48a00` | `#e9ba48` | Contested; a belief under examination; waiting on you.     |
| `--madder`    | `#b93127` | `#f59086` | Refuted.                                                   |
| `--sage`      | `#1f7446` | `#80d19d` | Confirmed by a person. Green is reserved for people.       |

Text on any surface: `--ink` ≥ 14:1, `--ink-2` ≥ 7:1, `--ink-3` ≥ 4.5:1 (on `--field` too). For coloured *text*
use the `-ink` variant (`--turmeric-ink`, `--sandstone-ink`); the base colour is for marks and fills. Washes
(`--indigo-wash` …) are backgrounds for text in the same colour. Filled primary controls in the dark theme use
`--primary` (`#4f5ce6`), not the light link indigo; on the slab the filled control is white with slab-coloured
text. The browser chrome (`theme-color`) is the slab.

### Type

Loaded with `next/font` in `apps/web/app/layout.tsx`:

- **Anek Latin** (`--font-sans`, `--font-heading`; variable weight and width): interface text at normal width;
  titles drawn narrow and firm. Use the utilities, which set family, weight, width and tracking together:
  `font-heading` (600, 92% wide) for titles in any element, `font-display` (700, 80% wide) for the largest
  (the home headline, the wordmark). `h1`–`h4` get the title style on their own (`h1` a little heavier and
  narrower) unless they carry `font-sans` or `font-serif`.
- **Anek Devanagari** (`--font-deva-display`): Devanagari inside a title, set automatically for `lang="hi|sa|mr"`
  inside a heading or `.font-heading`, a step lighter and at 0.86em so it sits beside the Latin, not over it.
- **Tiro Devanagari Sanskrit** (`--font-serif`, `--font-deva`): reading text, claims, quotations, and the
  Devanagari in them. One weight, with italics; `strong` in prose is set in Anek at 600 so no weight is
  synthesised.
- **Noto Sans Brahmi** (`--font-brahmi`): the wordmark's Brāhmī form only.

Every family carries each IAST mark (ā ī ū ṛ ṝ ḷ ṅ ñ ṭ ḍ ṇ ś ṣ ḥ ṃ) as a drawn glyph; this was checked by
rendering, and most popular families fail it. Check any new family the same way before adopting it.

| Role      | Class       | Size/leading | Face    | Use                                                         |
| --------- | ----------- | ------------ | ------- | ----------------------------------------------------------- |
| Headline  | `text-6xl`  | 76 / 0.95    | display | The home page's opening only (`text-5xl`, 60, on phones).   |
| Display   | `text-4xl`  | 46 / 1.02    | heading | The one title on a page.                                    |
| Title     | `text-3xl`  | 34 / 1.08    | heading | Section titles that open a page region; the claim (serif).  |
| Heading   | `text-2xl`  | 26 / 1.15    | heading | Part and chapter headings; rows of the chronicle.           |
| Subhead   | `text-xl`   | 21 / 1.25    | heading | Rail headings, tile titles, names in lists.                 |
| Lede      | `text-lg`   | 19 / 1.5     | serif   | The one-paragraph lede under a title; a question.           |
| Reading   | `text-base` | 17 / 1.62    | serif   | Prose. Measure 62–66ch.                                     |
| Note      | `text-note` | 16 / 1.5     | sans    | Summaries, tile text, answers, navigation.                  |
| UI        | `text-ui`   | 14.5 / 1.45  | sans    | Controls, rail text, list rows.                             |
| Small     | `text-sm`   | 13.5 / 1.45  | sans    | Meta lines, captions, credits.                              |
| Micro     | `text-xs`   | 12.5 / 1.4   | sans    | Tick labels, tags, the seal's words.                        |

Numbers in tables and timelines are tabular (`tnum`). Always import `cn` from `@/lib/utils`.

### Space, radius, elevation, motion

- **Space:** 4px grid. Within a component 4/8/12; between components 16/24; between sections 56 (`mt-14`), 80
  (`mt-20`) from 640px. Gutters are `--gutter` (16–48px fluid). The page frame (`--frame-max`) grows to 1880px.
- **Radius says what a thing is:** `--radius-sm` 3px for what is cut or printed (fields, tags, the seal's cells);
  `--radius-md` 8px for what is pressed or opened (buttons, inputs, tiles, rows that are links); `--radius-lg`
  14px for what floats. Fully round is for the shell's navigation (the pills in the top bar, the search field)
  and for dots and avatars, nothing else.
- **Elevation:** ground (`chuna`) → surface (`paper`, edge `rule`, no shadow) → floating (`paper`,
  `--shadow-pop`, tinted with the ink). The *field* is the only thing below the surface: `--field` with
  `--shadow-field`. No other shadow exists.
- **Motion:** 150ms `--ease-out-quart` for colour and opacity; 200ms for position; sheets 320ms `--ease-sheet`.
  Nothing moves because the reader scrolled; maps and timelines move only from a reader's action.
  `prefers-reduced-motion` turns all of it off.

## 3. Site map and navigation

Three groups, named the same way everywhere (the top bar, the More sheet, the footer):

- **The library**, four ways into the same history: Ages (`/`, and the reading pages `/p/…`), Timeline
  (`/timeline`), Places (`/places`), People (`/people`).
- **Your desk**, what the learner does with it: Learn (`/learn`), Canvas (`/canvas`), Notes (`/notes`), and
  Insights (`/insights`) in the footer.
- **The record**, how the content came to be: Proposed changes (`/review`), History of changes (`/audit`),
  Connect your AI (`/connect`).

Claims (`/c/…`), entities (`/e/…`) and sources (`/s/…`) are reached from what cites them and from search.

- **Top bar** (56px, the slab): the wordmark with its Brāhmī form; the library, a hairline, then the desk
  (Canvas and Notes from 1024px); "n to review" with a turmeric dot when proposals wait (from 1280px); the search
  field; the study partner; View. The current section is a filled pill. Sticky, solid, no blur.
- **Bottom bar** (phones): Ages, Places, Search, Learn and **More**, a bottom sheet listing every other section
  under the three group names, each with a few words saying what it is. Nothing a desktop reaches is out of reach
  on a phone. 44px targets, labels always shown.
- **Footer** (the slab): the wordmark with प्रमाण, one sentence, how much the site holds, the whole site map in
  the three groups, the licences. Hidden on the canvas board.

## 4. Layout

- **Wide (≥1280):** every page is a grid of content columns with no empty column. The reading column is
  40–44rem; everything else (atlas, pictures, evidence, lists) takes the rest. At 1920 the frame is 1880px: a
  reading page is contents (13rem) | reading (44rem) | rail (the remainder, ≥ 27rem).
- **Medium (768–1279):** two columns: reading | rail (20rem).
- **Narrow (<768):** one column. Evidence opens in a bottom sheet; maps are `inline`, 260–280px tall. Nothing is
  hidden on a phone that a desktop shows; it is folded.
- **PWA:** safe areas are honoured (`env(safe-area-inset-*)`); the bottom bar sits inside the home indicator.
- **Section rhythm:** a section is a title (heading face) with an optional one-sentence aside on the same
  baseline at the right (sans, `ink-2`), then content. No section is wrapped in a box.

## 5. Components

- **Buttons:** `default` (indigo fill, white; white fill on the slab), `outline` (paper, rule), `ghost`,
  `secondary` (indigo wash), `destructive` (madder wash), `link`. Height 36 (`sm` 32, `xs` 28, `lg` 44). Radius
  `md`. Sans 14.5 medium. An icon, when present, is 16px and leads.
- **Tags** (`Badge`): 3px radius, sans 12.5 medium, `h-5`. Variants by meaning: `evidence` (indigo), `place`
  (sandstone), `contested` (turmeric), `refuted` (madder), `person` (sage), `neutral`.
- **Fields** (`.field`): recessed evidence. Quotations, scanned text, the chain of evidence, a "Guess first" box.
  Padding 12–16; serif for quoted words; sans for the apparatus around them.
- **Tiles** (`.tile`): a whole-tile link. Paper, edge `rule`, radius `md`; on hover the edge and the title turn
  indigo; no lift, no shadow.
- **Rows:** lists are rows separated by `rule`, 40px minimum; the leading column is the thing, the trailing
  column its date or count in `tnum` `ink-3`. A row that is one link takes `paper` on hover.
- **The evidence seal:** four cells filled to the level (indigo; sage at L4; dashed outline at L0) plus a glyph
  for the kind of source. It never changes size: 6×9px cells, 3px gap.
- **The chain:** a claim, the words, the source, joined by a vertical hairline with a dot at each step (filled
  for the claim, open for what it rests on). Drawn in miniature in the home opening and in full on a claim page.
- **Chips on headings:** one row at most under a heading: date (indigo wash), places (sandstone wash), people
  (neutral). If there would be more than five, show four and "+n".
- **Panels that change the page** ("Customise this page", `components/yourview/Customise.tsx`) never cover the
  text they change: from 1680px the panel docks at the right and the page moves over for it (`html[data-dock]`);
  from 1024px it floats over the rail; below, it is a bottom sheet over the lower half only.
- **Appearance panel** (`components/shell/Appearance.tsx`): theme, text size, line width and evidence density,
  as `data-text`, `data-width` and `data-density` on `<html>`; the tokens respond, pages do not read them. Mark
  citation detail that should go at *quiet* with `.evidence-standard` and detail that appears only at *full* with
  `.evidence-full`; seals always show. Kept per learner (`user_views`, subject `site`); the learner's AI may
  change them over MCP and the panel says so, with Undo. Segmented choices use `Segments`.
- **Empty states** are designed, never blank: `EmptyState` (`components/ui/empty-state.tsx`), a recessed field
  with one sentence saying what would be here, an optional second saying why, and the one action that fills it.
- **Search** (⌘K): a floating dialog, `--radius-lg`, grouped results with meaning-coloured glyphs.
- **Images:** `CommonsImage` with sizes; credit in sans `ink-3` beneath or over a 40% ink gradient; the "Not a
  likeness" tag on imaginings.
- **Focus:** one indicator everywhere: 2px indigo outline, 2px offset (the light indigo on the slab).

### Where boxes are allowed

A box (edge or background) means one of exactly three things: *this whole thing is one link* (a tile); *this is
cut into the page* (a field: evidence, a question); *this floats* (menu, dialog, drawer, sheet, toast). Everything
else is laid out with type, space and rules.

## 6. Pages

**Home** (`/`, flagship). The opening is the slab, running on from the top bar: the promise as the headline
(display face, up to 88px), one sentence under it, then what is next for this learner (the age they are in, where
they stand in one line, one filled and one outline button). Beside it, from 1024px, *one real claim with what it
rests on*: the claim in the serif, the words of its source in a field, the source and its locator, the seal and a
link to the whole chain. The claim is chosen by rule (a short statement of fact whose quote was found word for
word; the best checked wins, a source of the time before a later one), so the promise is shown, not only said.
Then, on the ground: the *age band* with the atlas under it and the age at the current year described beside it;
then **the chronicle**, every age of the spine in time order as rows, numbered by its place in the spine. A
written age is a full row (dates, title with Devanagari, one line of story in the serif, a picture from inside
its page, what it holds and how far the learner has got) and is one link; an unwritten age is one quiet line in
its place. No card grid. Then the study partner's latest notes and the recent changes as plain lists.

**Era** (`/p/…`, reader): the *age line* across the frame, this era lit; the display title with Devanagari, the
dates in the heading face, the lede in the serif, the lead picture beside the lede at ≥1280. Parts: "Part n of m"
kicker, heading, one row of chips, prose on the page, the summary as prose with a thin indigo left rule, the
check in a *field*. Rail: heading + content blocks; notes from the AI as marginalia (§7).

**Entity** (`/e/…`): answer first. The age line, a kind kicker, the display title with Devanagari, the span, the
portrait at the right of the head, one sentence that says why this person or place matters, an evidence summary
line, "Life and reign" bars, then claims as rows in the order of the subject's life.

**Claim** (`/c/…`): the claim is the title of the page, in the serif. The chain of evidence is drawn in full;
the quotation is serif in a field with a 2px indigo left rule. The right column: where it stands, context,
related claims.

**Source** (`/s/…`): bibliographic head, then excerpts as fields.

**Learn** (`/learn`): the session is a single column centred in a wider frame whose sides hold the deck and the
seal key as plain blocks; a question is a field with the question in the serif; answers are outline buttons.

**Review** (`/review`), **History** (`/audit`): rows, not cards: title (heading face), who and when, what
changed, the decision at the right as a tag (`person` sage when a person decided; `neutral` when the delegation
did).

**Places**, **Timeline**, **People**: the page title, one sentence, then the atlas or the shared line of time
with rows under it. Filters are tags in one row.

**Connect** (`/connect`): a short page in the reading column. The token is a field with a copy button.

**Canvas** (`/canvas`): the ground is the canvas (dotted 16px grid). Items are tiles; an item showing evidence
renders as a field inside its tile. Items the AI added and the learner has not kept have a dotted ink edge. One
thin toolbar floats at the top left. No sidebar; no footer.

**Side effects are announced.** When a click on a claim or a date moves the map or the timeline, the moved thing
says so in place ("Map moved to 261 BCE", fades after 3 s). Maps and side panels never move on scroll.

## 7. The study partner

The AI is a reader's companion, not a chat. It appears in three ways and only these:

1. **Presence.** In the top bar, a 16px glyph: two concentric rings. Connected: the inner ring is filled.
   Not connected: both rings dotted. It opens a calm popover with a dotted edge. On phones it also shows as a
   6px dot on the bottom bar's Search item.
2. **Marginalia.** A note from the AI appears in the context rail (or under the part on a phone): sans, ink, a
   dotted left rule in `ink-3`, the visual it posted inside a field, and a time. Notes never interrupt reading.
3. **Asking.** "Ask your AI about this" is an outline button with the presence glyph that copies a prepared
   prompt. Once per page head and once per claim in the evidence drawer, never on every row.

Nothing bounces, blinks or greets. The partner has no avatar, no bubble, and no colour but ink and the dotted rule.

## 8. Copy

Plain and sentence case, in the reader's words (`apps/web/lib/labels.ts`). A button says what happens when it is
pressed ("Review 31 cards", not "Continue"). An empty screen says what would be there and offers the one action
that fills it. Errors say what happened and what to do; they do not apologise.
