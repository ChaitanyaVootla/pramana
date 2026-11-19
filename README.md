# Pramāṇa

Indian history, with the evidence attached.

_Pramāṇa_ (प्रमाण) is the Sanskrit term for a means of valid knowledge. It is the working name of an open-source learning platform where every statement points to the exact words it rests on, in a source you can open. Where scholars disagree, you see each reading and what supports it.

The content is structured, not just prose:

- **claims**: one proposition each;
- **excerpts**: verbatim quotes with page, verse or edict locators;
- **sources**: CSL-JSON records, with edition and translation chains;
- **entities**: people, places, periods and events, with fuzzy dates and places;
- **pages**: readable views built from all of the above.

Every change is proposed, dry-run, reviewed by a person and then applied, with an append-only audit trail. AI agents work on the platform over [MCP](https://modelcontextprotocol.io), and they can only propose changes. A person approves them.

> **Status: MVP.** Live at <https://pramana.vootlachaitanya.com>. Run locally, it is single-user with no sign-in, so keep it on `localhost`. To host it for others, turn on Google sign-in (`PRAMANA_AUTH=google`, see `.env.example`): anyone can read, signed-in learners keep their own notes and cards, and only the owner approves changes. The MCP server is always localhost-only.

## What is here

- **Reading pages.** Theme tabs (governance, war, society…) and claim lists with an _evidence rail_ that shows how far each claim's sourcing has been checked. Selecting a claim shows its exact quote, source and checks in the margin.
- **Evidence lineage.** For any claim (`/c/<id>`): the quote, the matching passage in the stored copy of the source, the edition, and the work it belongs to. How the claim was found (e.g. via a pinned Wikipedia revision) is shown separately from what supports it.
- **Quote verification.** Source texts (public-domain OCR from the Internet Archive, Wikipedia revisions, web pages) are captured as immutable, content-addressed snapshots. Each quote is matched against its snapshot, ignoring diacritics, punctuation, hyphenation and OCR noise, and gets W3C Web Annotation selectors.
- **Review.** AI or human proposals arrive as changesets with a dry-run report: quotes found or not, and sourcing warnings. You approve or reject them at `/review`.
- **Learning.** Spaced repetition (FSRS) over claims, with three card types: misconceptions as true/false, prompt cards, and "how well supported is this?". It also tracks confidence calibration.
- **Co-learning with an AI.** Ask questions in Claude Code; answers, tables, charts, timelines and maps appear live beside the page you are reading.
- **Timeline and map.** Uncertain dates fade at their edges; uncertain locations are drawn dotted or faded.

## Quick start

Requirements: Node 22+, pnpm 11, Docker.

```bash
pnpm install
cp .env.example .env          # set PRAMANA_USER_HANDLE / PRAMANA_USER_NAME
pnpm db:up                    # Postgres 18 on 127.0.0.1:5442
pnpm db:migrate
pnpm seed                     # proposes the first pages via MCP (you approve them)
pnpm dev                      # http://localhost:3000
```

Then open <http://localhost:3000/review>. Read the two proposals: the timeline spine, then the Maurya Empire page, which depends on it. Approve the second with its dependency, and read <http://localhost:3000/p/maurya-empire>.

## Using it with Claude Code

The repository ships a project MCP config (`.mcp.json`). Start Claude Code in the repo root, approve the `pramana` server, and ask, for example:

- "Read the Maurya Empire page and quiz me on what's due."
- "What's the actual evidence that Aśoka converted after Kalinga? Post your answer with a table next to the page."
- "Find a public-domain source for the Gupta Empire and propose a page."

Every tool call is recorded as **claude-code acting for you, in session X**. Content changes arrive at `/review`. To use the server from another directory or client:

```bash
claude mcp add pramana -- /path/to/repo/node_modules/.bin/tsx /path/to/repo/apps/mcp/src/main.ts
```

The server's instructions explain the rules agents follow: quote only from captured snapshots, never invent page numbers, write dates in EDTF, and treat Wikipedia as tertiary.

## Layout

```
packages/core        zod schemas and pure logic: EDTF dates, quote matching, change ops, verification ladder
packages/db          Drizzle schema, migrations (append-only audit trigger, live-update notify)
packages/connectors  Wikidata, Wikipedia (citation mining), Internet Archive, Crossref/DOI, Open Library, web
packages/services    the single read/write path used by both the web app and MCP; every write is audited
apps/mcp             MCP server (stdio)
apps/web             Next.js app
scripts/seed         first content, proposed through MCP
docs/                design.md (how it works) and standards.md (date, citation and data standards)
```

## Commands

|                                        |                                             |
| -------------------------------------- | ------------------------------------------- |
| `pnpm dev` / `pnpm build`              | web app                                     |
| `pnpm mcp`                             | MCP server on stdio                         |
| `pnpm db:generate` / `pnpm db:migrate` | schema migrations                           |
| `pnpm seed`                            | propose seed content                        |
| `pnpm test` / `pnpm typecheck`         | unit tests / types across all packages      |
| `pnpm screenshot <dir> /path …`        | screenshots of the running app (dev helper) |

## Licences

- Code: [GNU AGPL-3.0-or-later](LICENSE).
- Content you create on the platform: CC BY-SA 4.0, which is compatible with Wikipedia.
- Quoted sources keep their own licences, recorded per source. Copyrighted works are cited by location or with short quotations only.
