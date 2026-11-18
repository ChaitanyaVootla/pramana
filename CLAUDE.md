# Working on Pramāṇa

An evidence-first history learning platform. Read `docs/design.md` first, `docs/visual.md` before any UI work, and
`docs/standards.md` for dates and citations.

## Commands

- `pnpm db:up && pnpm db:migrate`: Postgres on 127.0.0.1:5442 (Docker). DBs: `pramana` (main) and `pramana_preview`.
- `pnpm dev`: web on :3000. `pnpm build`: production build.
- `pnpm typecheck`, `pnpm test`: run both before saying something works.
- `pnpm seed`: proposes seed content through MCP and never applies it.
  - Further content: `scripts/seed/maurya-chapters-index.ts`, `scripts/seed/independence-index.ts`.
  - Importers: `scripts/import/` (Wikidata, Cliopatria).
  - All of these take `--approve-preview`, for the preview DB only.
- After changing date logic in core, run `pnpm tsx scripts/recompute-bounds.ts`; after changing search folding, run
  `pnpm tsx scripts/recompute-search.ts`. Both rebuild derived data.

### Dev servers

`scripts/dev/serve.sh main|preview|test|novice|blank` runs one server:
- 3000 main: the user's own data, as the user;
- 3100 preview;
- 3200 test-learner;
- 3300 test-novice;
- 3500 a blank learner.

All but main use the preview DB.
- `scripts/dev/restart.sh [names]` restarts servers in the background and waits until they answer.
  - With no names it restarts the preview-DB servers; `all` adds main.
  - `--clean` also clears a server's build cache, which fixes one stuck reloading.
  - Run it after a migration, since long-running servers keep the old Drizzle schema.
- Logs go to `~/Library/Logs/pramana/`, never inside the repo.
- `scripts/dev/prod.sh`: a production build on :3400 (preview DB, test learner). It builds into alternating directories,
  so the old server keeps serving until the new one is ready. Measure speed there, never on dev.

### Checking UI

- Automated browsing must never act as the real user: pages record visits, skims and answers. Never automate :3000.
  - Use :3200 for screenshots and anything that writes.
  - Keep :3300 and :3500 fresh for usability studies.
  - For tests that answer questions, start a throwaway learner: `PRAMANA_USER_HANDLE=test-scratch… NEXT_DIST_DIR=.next-scratch… npx next dev --port 36xx` in `apps/web`. Stop it, and delete its build directory, when done.
- `PRAMANA_WEB_URL=http://127.0.0.1:3200 pnpm screenshot <dir> /path`:
  - `"/path!selector"` clicks, and `"/path@selector"` scrolls the target to the top;
  - it waits for hydration and retries on reloads, and never waits for network idle (the page keeps an SSE stream open);
  - full-page shots grow the viewport, so the map's WebGL canvas may show grey; take viewport shots to judge maps.
- `PRAMANA_WEB_URL=… SHOT_WIDTH=390 SHOT_THEME=dark pnpm tsx scripts/axe.ts /path "/path!selector"`: accessibility.
  Check 1440, 1920 and 390, in light and dark.
- `pnpm check:atlas` (maps draw borders and places); `pnpm tsx scripts/check-canvas.ts` (board).
- `pnpm tsx scripts/dev/mcp-loop.ts` (the HTTP MCP end to end); `pnpm tsx scripts/dev/extension-check.ts` (the
  Claude Desktop extension).

## Rules

- **Writes.** All writes go through `packages/services`. zod schemas live in `packages/core`, and JSONB is validated
  before it is written.
- **Content changes are changesets.**
  - A human approves them in the web UI, or an agent approves them under the user's standing delegation
    (`services/delegation.ts`, granted 2026-10-18 at the user's request).
  - Delegated approvals are recorded as the agent's, naming the delegation, never as the user's own review.
  - Only the lead's pipeline (`scripts/main/pipeline.ts`) approves on main; other agents propose. If the delegation is
    revoked, stop approving.
- **The main-DB pipeline.** `pnpm tsx scripts/main/pipeline.ts` runs every follow-up script in order and approves as it
  goes. `--approve-only` approves what is pending, and `--from <step>` starts partway. Its guards:
  - it holds a change whose identical ops were already applied twice in a day, which means two scripts are undoing
    each other;
  - only one run goes at a time;
  - a step that hangs is stopped after 10 minutes.

  Fix scripts must be idempotent against each other. Add new ones to its STEPS.
- **Personal data is scoped to its owner:** notes, canvases, user views, presence, learner answers, and the audit events
  about them. Every read takes the viewer's context, and live events carry an owner. Keep it that way, and extend
  `packages/services/src/privacy.test.ts` when adding personal data. Personal events never invalidate the content
  cache.
- **Localhost only.** The HTTP MCP endpoint (`/api/mcp`) and the extension download refuse foreign Host and Origin
  headers and need the token in `data/mcp-token`, which is gitignored. Never weaken these checks.
- **Migrations, one at a time:**
  1. create `.migration.lock` with noclobber;
  2. edit `packages/db/src/schema.ts`;
  3. run `pnpm db:generate`;
  4. migrate both DBs;
  5. delete the lock;
  6. run `scripts/dev/restart.sh`.
- **Nothing scratch in the repo.** The dev servers watch the whole repo, and any file written there (a probe script, a
  log, a lock) reloads every open page. Scratch files go in the session scratchpad; locks and logs go outside the repo.
- **Edits that keep the tree compiling:** several agents and servers read the tree at once.
  - Write a multi-step change to a scratch copy, then replace the file in one step.
  - Order cross-file renames so every step compiles: add the new name, switch the callers, then remove the old one.
  - Before editing a file another agent is working in, ask them.
- **Evidence.** Never fabricate quotes, page numbers or coordinates. Capture a snapshot, find the passage and copy the
  exact words. Coordinates come from Wikidata, or are left out.
- **Dates.** EDTF with astronomical years. Prefer `{ year, era: "BCE" }` input.
- **UI.**
  - Follow `docs/visual.md` ("dyed in indigo"): indigo is the brand, the ink and evidence/time; sandstone is place,
    turmeric is contested or waiting on you, madder is refuted, sage is a person's confirmation. The slab
    (`.on-slab`) is only the top bar, the footer and the home opening.
  - Two voices: Anek (`font-heading`, `font-display`, `font-sans`) for titles, names, labels and numbers; Tiro
    (`font-serif`) for prose, claims, quotations and questions. Check IAST glyph coverage before adopting any font.
  - Evidence sits in fields; no card grids, ALL-CAPS labels, middle-dot meta strings, arrows on links or monospace
    data. Radii: 3px cut, 8px pressed, 14px floating; pills only in shell navigation.
  - Maps and side panels never move on scroll; they change only when the reader asks.
  - Copy is plain and sentence case, in the reader's words (`apps/web/lib/labels.ts`).
