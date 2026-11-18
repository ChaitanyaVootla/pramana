import { createCn } from "cn/config";

/**
 * Class merging (clsx + tailwind-merge semantics), told about our custom type
 * scale so `text-ui` / `text-note` are font sizes, not colours, and survive
 * alongside colour classes such as `text-ink-2`; and about our two shadows.
 * Roles for each size are in docs/visual.md ("Type").
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["ui", "note"] }],
      shadow: [{ shadow: ["pop", "field", "card"] }],
    },
  },
});

/** Type roles as class strings, so a page can name a role instead of a size. */
export const TYPE = {
  /** The one title on a page. */
  display: "font-serif text-4xl text-ink",
  /** A section that opens a page region. */
  title: "font-serif text-3xl text-ink",
  /** A part or chapter heading. */
  heading: "font-serif text-2xl text-ink",
  /** A rail heading or a tile title. */
  subhead: "font-serif text-xl text-ink",
  /** The one-paragraph lede under a title. */
  lede: "font-serif text-lg text-ink-2",
  /** Prose. */
  reading: "font-serif text-base text-ink",
  /** Summaries, tile text, answers. */
  note: "font-sans text-note text-ink-2",
  /** Controls, navigation, rows. */
  ui: "font-sans text-ui text-ink",
  /** Meta lines, captions, credits. */
  small: "font-sans text-sm text-ink-3",
  /** Tick labels, tags. */
  micro: "font-sans text-xs text-ink-3",
  /** The context line above a title. */
  kicker: "font-sans text-ui text-ink-2",
} as const;
