"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/**
 * The page's shared attention: what the reader is pointing at, so the map and
 * the timeline can answer without the page redrawing. Reading (scrolling) only
 * moves a quiet `emphasis`; the camera and the borders move only when the
 * reader asks (hovering or clicking a place, a person, a date or a claim).
 *
 *   hover    a place, person or event under the pointer or focus: highlighted, never flown to
 *   pinned   what the reader clicked (a place, a claim's places): highlighted and framed
 *   emphasis the chapter being read: its places drawn a little stronger, no camera move
 *   year     the year the atlas shows borders for; set by the scrubber, a date chip or a claim
 *   suggest  a year the page offers (the chapter being read is about 261 BCE): the atlas shows a
 *            quiet "This part: c. 261 BCE · Show" pill, and only the reader's click sets the year.
 *            It has a context of its own (useAtlasSuggest), so a page may update it as often as
 *            it likes (on every scroll) without re-rendering the atlas, the map or anything else.
 */
export interface AtlasState {
  hover: string[];
  pinned: { ids: string[]; nonce: number; frame: boolean } | null;
  emphasis: string[];
  year: number | null;
  /** Set when the year was chosen by the reader (so the atlas can animate to it). */
  yearNonce: number;
}

/** A year the page offers (see useAtlasSuggest), never applied by itself. */
export type AtlasSuggest = { year: number; label: string } | null;

export interface AtlasBus extends AtlasState {
  setHover: (ids: string[]) => void;
  /** Pin entity ids (frame them on the map when `frame`, default true). Same ids again unpins. */
  pin: (ids: string[], opts?: { frame?: boolean; toggle?: boolean }) => void;
  clearPin: () => void;
  setEmphasis: (ids: string[]) => void;
  setYear: (year: number | null, opts?: { fromReader?: boolean }) => void;
  /** Offer a year (or withdraw the offer with null); the atlas shows it as a pill. */
  setSuggest: (suggest: AtlasSuggest) => void;
  /** True when a provider is mounted (chips elsewhere stay inert). */
  live: boolean;
}

const noop = () => {};
const Ctx = createContext<AtlasBus>({
  hover: [],
  pinned: null,
  emphasis: [],
  year: null,
  yearNonce: 0,
  setHover: noop,
  pin: noop,
  clearPin: noop,
  setEmphasis: noop,
  setYear: noop,
  setSuggest: noop,
  live: false,
});

/** The bus's setters alone: stable, so components that only point (chips) never re-render on bus changes. */
export type AtlasActions = Pick<
  AtlasBus,
  "setHover" | "pin" | "clearPin" | "setEmphasis" | "setYear" | "setSuggest" | "live"
>;
const SuggestCtx = createContext<AtlasSuggest>(null);

/** The year the page offers, read only by the atlas's pill (its own context: see AtlasState). */
export function useAtlasSuggest(): AtlasSuggest {
  return useContext(SuggestCtx);
}

const ActionsCtx = createContext<AtlasActions>({
  setHover: noop,
  pin: noop,
  clearPin: noop,
  setEmphasis: noop,
  setYear: noop,
  setSuggest: noop,
  live: false,
});

function same(a: string[], b: string[]) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function AtlasProvider({
  initialYear = null,
  children,
}: {
  initialYear?: number | null;
  children: React.ReactNode;
}) {
  const [hover, setHoverState] = useState<string[]>([]);
  const [pinned, setPinned] = useState<AtlasState["pinned"]>(null);
  const [emphasis, setEmphasisState] = useState<string[]>([]);
  const [year, setYearState] = useState<number | null>(initialYear);
  const [yearNonce, setYearNonce] = useState(0);
  const [suggest, setSuggestState] = useState<AtlasSuggest>(null);
  const nonce = useRef(0);

  const setHover = useCallback(
    (ids: string[]) => setHoverState((cur) => (same(cur, ids) ? cur : ids)),
    [],
  );
  const setEmphasis = useCallback(
    (ids: string[]) => setEmphasisState((cur) => (same(cur, ids) ? cur : ids)),
    [],
  );
  const pin = useCallback((ids: string[], opts?: { frame?: boolean; toggle?: boolean }) => {
    setPinned((cur) => {
      if (opts?.toggle !== false && cur && same(cur.ids, ids)) return null;
      nonce.current += 1;
      return { ids, nonce: nonce.current, frame: opts?.frame ?? true };
    });
  }, []);
  const clearPin = useCallback(() => setPinned(null), []);
  const setYear = useCallback((y: number | null, opts?: { fromReader?: boolean }) => {
    setYearState(y === null ? null : Math.round(y));
    if (opts?.fromReader) setYearNonce((n) => n + 1);
  }, []);

  const setSuggest = useCallback(
    (next: AtlasSuggest) =>
      setSuggestState((cur) =>
        cur?.year === next?.year && cur?.label === next?.label ? cur : next,
      ),
    [],
  );

  const value = useMemo<AtlasBus>(
    () => ({
      hover,
      pinned,
      emphasis,
      year,
      yearNonce,
      setHover,
      pin,
      clearPin,
      setEmphasis,
      setYear,
      setSuggest,
      live: true,
    }),
    [
      hover,
      pinned,
      emphasis,
      year,
      yearNonce,
      setHover,
      pin,
      clearPin,
      setEmphasis,
      setYear,
      setSuggest,
    ],
  );
  const actions = useMemo<AtlasActions>(
    () => ({ setHover, pin, clearPin, setEmphasis, setYear, setSuggest, live: true }),
    [setHover, pin, clearPin, setEmphasis, setYear, setSuggest],
  );
  return (
    <ActionsCtx.Provider value={actions}>
      <Ctx.Provider value={value}>
        <SuggestCtx.Provider value={suggest}>{children}</SuggestCtx.Provider>
      </Ctx.Provider>
    </ActionsCtx.Provider>
  );
}

export function useAtlasBus(): AtlasBus {
  return useContext(Ctx);
}

/** Only the setters (for chips, links and buttons that drive the atlas but do not read it). */
export function useAtlasActions(): AtlasActions {
  return useContext(ActionsCtx);
}

/**
 * Props that make any element point at entities on the atlas: hover or focus
 * highlights them, leaving clears. Spread onto chips and inline links.
 */
export function usePointAt(ids: string[] | undefined) {
  const bus = useAtlasActions();
  const key = ids?.join(",") ?? "";
  return useMemo(() => {
    if (!bus.live || !ids?.length) return {};
    const on = () => bus.setHover(ids);
    const off = () => bus.setHover([]);
    return { onPointerEnter: on, onPointerLeave: off, onFocus: on, onBlur: off };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus.live, bus.setHover, key]);
}
