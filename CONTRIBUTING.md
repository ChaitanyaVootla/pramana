# Contributing

## Setup

See the README quick start. You need Node 22+, pnpm 11 and Docker.

## Code

- TypeScript throughout. Workspace packages are consumed as source, with no build step.
- **All writes go through `packages/services`**, never directly to the database from an app. That is how the audit trail stays complete.
- Every structured input or JSONB value has a zod schema in `packages/core`. Validate at the boundary, then trust the types.
- Schema changes: edit `packages/db/src/schema.ts`, run `pnpm db:generate`, and commit the migration.
- Before a PR: `pnpm typecheck && pnpm test`. Add tests for pure logic (dates, matching, ops). UI is checked visually for now (`pnpm screenshot`).

## Content

These rules apply to people and agents alike:

1. **One claim, one proposition.** State it plainly and neutrally.
2. **Quote only what you have read in a captured snapshot**, and copy the exact words. Never invent quotes or page numbers.
3. **Cite copyrighted modern scholarship by location**, or with a short quotation. Record how you found it.
4. **Wikipedia is a discovery tool and a tertiary source.** It is never the only support for "well supported".
5. **Record disagreement.** Use `debate` blocks, `lenses`, and misconception claims linked to their corrections with `corrects`.
6. **Say how a date or place was established** (`basis`, `certainty`).

Content is licensed CC BY-SA 4.0. Code is AGPL-3.0-or-later.
