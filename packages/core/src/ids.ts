import { z } from "zod";

/**
 * UUIDv7 (RFC 9562): time-ordered, so primary keys sort by creation time and
 * index well. Generated in the application (not the database) so a changeset
 * can reference objects it is about to create before it is applied.
 */
export function uuidv7(now: number = Date.now()): string {
  // Web Crypto (Node 19+ and browsers), so this module also works client-side.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ts = BigInt(now);
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((ts >> BigInt(8 * (5 - i))) & 0xffn);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 9562 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const Uuid = z.uuid();

/**
 * Lowercase ASCII slug. Diacritics are folded (Aśoka -> asoka) so URLs stay
 * typeable; the display label keeps the diacritics.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export const Slug = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase ASCII words joined by hyphens");

/**
 * A reference inside a changeset: either the UUID of an existing object, or
 * "@name" pointing at an object created earlier in the same changeset (or in a
 * changeset it depends on) whose create op declared `ref: "name"`.
 */
export const RefName = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,63}$/i, "ref names are letters, digits, '_' or '-' (max 64)");
export const Ref = z.union([
  z.uuid(),
  z.string().regex(/^@[a-z][a-z0-9_-]{0,63}$/i, 'use a UUID or "@refName"'),
]);
export type Ref = z.infer<typeof Ref>;

export function isLocalRef(value: string): boolean {
  return value.startsWith("@");
}

/** Entities can be referenced by id, "@ref", or slug. */
export const EntityRef = z.union([Ref, Slug]);
