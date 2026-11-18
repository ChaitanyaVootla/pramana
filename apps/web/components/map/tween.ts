import type { Map as MlMap } from "maplibre-gl";

/**
 * Smooth feature-state for MapLibre. Paint expressions that read
 * feature-state do not transition on their own, so each key is a number
 * eased towards its target over ~300 ms here, and the layers interpolate on
 * it: h = hovered, p = pinned, e = emphasised (0 or 1), t = how much a place
 * belongs to the year shown (0..1, see timeWeight in MapCanvas), y = a
 * border in force in the year shown (crossfaded), g = the outline it had just
 * before a change (the onion-skin, faded out slowly).
 *
 * A key's first value is set at once (no fade-in when a map opens). With
 * reduced motion every change is immediate.
 */
interface Tween {
  from: number;
  to: number;
  t0: number;
  value: number;
  duration: number;
}

export class StateTweens {
  private tweens = new Map<string, Tween>();
  private raf = 0;
  private readonly reduced: boolean;

  /**
   * `mirrors`: sources that get the same states (a layer's names live in a
   * source of their own, so its shapes never wait for fonts).
   */
  constructor(
    private readonly map: MlMap,
    private readonly duration = 300,
    private readonly mirrors: Record<string, string | string[]> = {},
  ) {
    this.reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /** For every id of a source, set each key to the value its function gives (booleans are 0 or 1). */
  sync(source: string, ids: string[], keys: Record<string, (id: string) => number | boolean>) {
    for (const id of ids)
      for (const [key, of] of Object.entries(keys)) {
        const v = of(id);
        this.set(source, id, key, typeof v === "boolean" ? (v ? 1 : 0) : v);
      }
  }

  /**
   * Ease a key to `value`. Its first value starts from `opts.from` when given
   * (highlights from 0); otherwise it is set at once.
   */
  set(
    source: string,
    id: string,
    key: string,
    value: number,
    opts: { from?: number; duration?: number } = {},
  ) {
    const k = `${source}\u0001${id}\u0001${key}`;
    const tw = this.tweens.get(k);
    const duration = opts.duration ?? this.duration;
    if (!tw) {
      const start = this.reduced
        ? value
        : (opts.from ?? (key === "h" || key === "p" || key === "e" ? 0 : value));
      this.tweens.set(k, { from: start, to: value, t0: performance.now(), value: start, duration });
      this.apply(k, start);
      if (start !== value) this.schedule();
      return;
    }
    if (Math.abs(tw.to - value) < 1e-3) return;
    if (this.reduced) {
      Object.assign(tw, { from: value, to: value, value });
      this.apply(k, value);
      return;
    }
    Object.assign(tw, { from: tw.value, to: value, t0: performance.now(), duration });
    this.schedule();
  }

  /** Jump a key to `from` and ease it to `to` (the onion-skin). Skipped with reduced motion. */
  pulse(source: string, id: string, key: string, from: number, to: number, duration: number) {
    if (this.reduced) return;
    const k = `${source}\u0001${id}\u0001${key}`;
    this.tweens.set(k, { from, to, t0: performance.now(), value: from, duration });
    this.apply(k, from);
    this.schedule();
  }

  /** The current (eased) value of a key, if it was ever set. */
  value(source: string, id: string, key: string): number | undefined {
    return this.tweens.get(`${source}\u0001${id}\u0001${key}`)?.value;
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private schedule() {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private apply(k: string, v: number) {
    const [source, id, key] = k.split("\u0001") as [string, string, string];
    if (!this.map.getSource(source)) return;
    this.map.setFeatureState({ source, id }, { [key]: v });
    for (const mirror of [this.mirrors[source] ?? []].flat())
      if (this.map.getSource(mirror))
        this.map.setFeatureState({ source: mirror, id }, { [key]: v });
  }

  private tick = (now: number) => {
    let moving = false;
    for (const [k, tw] of this.tweens) {
      if (tw.value === tw.to) continue;
      const k01 = this.reduced ? 1 : Math.min(1, (now - tw.t0) / tw.duration);
      // Smoothstep, so changes ease in and out.
      tw.value = k01 >= 1 ? tw.to : tw.from + (tw.to - tw.from) * k01 * k01 * (3 - 2 * k01);
      this.apply(k, tw.value);
      if (tw.value !== tw.to) moving = true;
    }
    this.raf = moving ? requestAnimationFrame(this.tick) : 0;
  };
}
