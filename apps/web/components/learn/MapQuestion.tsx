"use client";

import { haversineKm } from "@pramana/core";
import type { EntityCard } from "@pramana/services";
import { Crosshair } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { MapCanvas, type MapPin } from "@/components/map/MapCanvas";
import { Button } from "@/components/ui/button";

/** The subcontinent, the default view for "Tap where X was" ([west, south, east, north]). */
const SUBCONTINENT: [number, number, number, number] = [68, 7, 92, 34];

/**
 * A map to answer on: no places drawn (that would give the answer away), just
 * the relief, rivers and seas. A tap drops the pin; keyboard users pan with the
 * arrow keys and drop it at the crosshair.
 */
export function MapAnswer({
  pin,
  onPin,
  disabled,
  label,
}: {
  pin: [number, number] | null;
  onPin: (at: [number, number]) => void;
  disabled?: boolean;
  /** What is being placed, for the accessible description. */
  label: string;
}) {
  const [center, setCenter] = useState<[number, number] | null>(null);
  // The crosshair is for aiming the next drop: hidden once a pin is down, until the map moves again,
  // so the pin and its "Your answer" label are the only mark on the answer.
  const [aiming, setAiming] = useState(true);
  const drop = (at: [number, number]) => {
    setAiming(false);
    onPin(at);
  };
  const helpId = useId();
  // Touch screens get touch words; keyboards and mice get the arrow keys.
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  // The subcontinent is taller than it is wide: a narrow map (at most 28rem,
  // 0.8 as tall as wide) frames it, and stays small beside the text.
  const [height, setHeight] = useState(260);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setHeight(Math.round(Math.min(340, Math.max(240, el.clientWidth * 0.8))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pins: MapPin[] = pin ? [{ id: "guess", at: pin, tone: "guess", label: "Your answer" }] : [];
  return (
    <div className="font-sans">
      <div
        ref={wrap}
        className="max-w-[28rem]"
        role="group"
        aria-label={`Answer on the map: ${label}`}
        aria-describedby={helpId}
      >
        <MapCanvas
          features={[]}
          context={false}
          bounds={SUBCONTINENT}
          label={`Map question: place ${label}`}
          attributionAsText
          height={height}
          pins={pins}
          onPick={disabled ? undefined : drop}
          onViewChange={(c) => {
            setCenter(c);
            setAiming(true);
          }}
        >
          {(!pin || aiming) && (
            <Crosshair
              className="pointer-events-none absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-ink-2/70"
              aria-hidden
            />
          )}
        </MapCanvas>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !center}
          onClick={() => center && drop(center)}
        >
          Drop the pin at the centre
        </Button>
        <span id={helpId} aria-live="polite">
          {pin
            ? touch
              ? "Pin dropped. Tap elsewhere to move it."
              : "Pin dropped. Click elsewhere, or move the map and drop it again, to change it."
            : touch
              ? "Tap the map where you think it was, or drag the map and drop the pin at the centre."
              : "Click the map where you think it was, or move the map with the arrow keys or by dragging and drop the pin at the centre."}
        </span>
      </div>
    </div>
  );
}

/** After answering: the place where it was, and the learner's pin. */
export function MapResult({
  entity,
  pin,
  height = 220,
}: {
  entity: EntityCard;
  pin: [number, number] | null;
  height?: number;
}) {
  const at =
    entity.geo?.geometry.type === "Point"
      ? (entity.geo.geometry.coordinates as [number, number])
      : null;
  // A pin on (or within a few km of) the place would draw both labels on top of each other: one label says it.
  const onIt = Boolean(pin && at && haversineKm(pin, at) <= 5);
  const pins: MapPin[] = [
    ...(pin ? [{ id: "guess", at: pin, tone: "guess" as const, label: onIt ? undefined : "Your answer" }] : []),
    ...(at ? [{ id: "answer", at, tone: "answer" as const, label: onIt ? `Your answer: ${entity.label}` : entity.label }] : []),
  ];
  const features = entity.geo
    ? [
        {
          id: entity.id,
          slug: entity.slug,
          label: entity.label,
          kind: entity.kind,
          whenLabel: entity.whenLabel,
          geo: entity.geo,
        },
      ]
    : [];
  return (
    // Decorative (the verdict says the distance in words): inert, so its map controls are not tab stops either.
    <div aria-hidden inert className="max-w-[28rem]">
      <MapCanvas
        features={at ? [] : features}
        context={false}
        bounds={boundsAround(pins.map((p) => p.at))}
        height={height}
        pins={pins}
        compact
        label={`Map: where ${entity.label} is, and your pin`}
        attributionAsText
      />
    </div>
  );
}

function boundsAround(points: [number, number][]): [number, number, number, number] {
  if (!points.length) return SUBCONTINENT;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const pad = 3;
  return [
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) + pad,
    Math.max(...ys) + pad,
  ];
}
