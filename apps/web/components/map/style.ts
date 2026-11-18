import type { StyleSpecification } from "maplibre-gl";

/**
 * The history basemap: physical geography first, the present day only as a
 * faint, optional reference.
 *
 * - Land and water from OpenFreeMap vector tiles (OpenStreetMap data).
 * - Relief: hillshading from open terrain tiles (Mapzen/AWS, Terrarium
 *   encoding), plus Natural Earth II shaded relief at low zooms in light mode.
 * - Rivers, seas, mountain ranges, deserts, plateaus and plains from Natural
 *   Earth (public domain), clipped to South Asia (public/geo, built by
 *   scripts/geo/build-basemap-data.ts). Rivers matter: they explain where
 *   cities, kingdoms and routes were.
 * - Modern cities and borders: Natural Earth / OSM, shown faintly when asked.
 */

export type MapTheme = "light" | "dark";

interface Palette {
  land: string;
  water: string;
  waterLine: string;
  river: string;
  sand: string;
  ice: string;
  shadow: string;
  highlight: string;
  accent: string;
  regionLabel: string;
  marineLabel: string;
  riverLabel: string;
  city: string;
  cityLabel: string;
  border: string;
  halo: string;
  reliefOpacity: number;
  shadeExaggeration: number;
  /** Rivers stay below the borders: dimmer in dark mode, where light lines glow. */
  riverOpacity: number;
}

const PALETTES: Record<MapTheme, Palette> = {
  light: {
    // docs/visual.md: land is paper-white on the blued ground, water a quiet indigo-blue, no yellow.
    land: "#fbfbfd",
    water: "#cdd6ee",
    waterLine: "#aebbdf",
    river: "#8399cf",
    sand: "#eeeae2",
    ice: "#fafafa",
    shadow: "#4b4d57",
    highlight: "#ffffff",
    accent: "#2733c4",
    regionLabel: "#63668a",
    marineLabel: "#5468a8",
    riverLabel: "#5468a8",
    city: "#8386a3",
    cityLabel: "#63668a",
    border: "#9498b8",
    halo: "#fbfbfd",
    reliefOpacity: 0.24,
    shadeExaggeration: 0.4,
    riverOpacity: 0.9,
  },
  dark: {
    // Indigo land a step above the ground (#0b0d24), water a step below.
    land: "#191d47",
    water: "#080a1c",
    waterLine: "#262b5c",
    river: "#4a62a8",
    sand: "#1e2250",
    ice: "#272c5e",
    shadow: "#04051a",
    highlight: "#3b4180",
    accent: "#a5aeff",
    regionLabel: "#9a9ec4",
    marineLabel: "#7388c8",
    riverLabel: "#7d92d0",
    city: "#7d81a8",
    cityLabel: "#979bc2",
    border: "#585e94",
    halo: "#191d47",
    reliefOpacity: 0,
    shadeExaggeration: 0.6,
    riverOpacity: 0.45,
  },
};

export function paletteFor(theme: MapTheme): Palette {
  return PALETTES[theme];
}

const FONT_REGULAR = ["Noto Sans Regular"];
const FONT_ITALIC = ["Noto Sans Italic"];
const FONT_BOLD = ["Noto Sans Bold"];

/** The relief: Natural Earth shaded relief and hillshading from terrain tiles (raster, the heaviest part). */
export function reliefSources(): StyleSpecification["sources"] {
  return {
    relief: {
      type: "raster",
      tiles: ["https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 6,
      attribution: "Natural Earth",
    },
    dem: {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 11,
      attribution: "Terrain: Mapzen / AWS Terrain Tiles",
    },
  } as StyleSpecification["sources"];
}

export function reliefLayers(theme: MapTheme): StyleSpecification["layers"] {
  const p = PALETTES[theme];
  return [
    ...(p.reliefOpacity > 0
      ? [
          {
            id: "relief",
            type: "raster" as const,
            source: "relief",
            maxzoom: 7,
            paint: {
              "raster-opacity": p.reliefOpacity,
              "raster-saturation": -0.55,
              "raster-contrast": -0.1,
            },
          },
        ]
      : []),
    {
      id: "hillshade",
      type: "hillshade" as const,
      source: "dem",
      paint: {
        "hillshade-shadow-color": p.shadow,
        "hillshade-highlight-color": p.highlight,
        "hillshade-accent-color": p.shadow,
        "hillshade-exaggeration": p.shadeExaggeration,
        "hillshade-illumination-direction": 315,
      },
    },
  ] as StyleSpecification["layers"];
}

/**
 * `relief: false` leaves out the relief, for a map that adds it once land and
 * water are drawn (see MapCanvas), so the first paint is legible, not bare terrain.
 */
export function buildBasemapStyle(
  theme: MapTheme,
  options: { modern: boolean; compact?: boolean; relief?: boolean },
): StyleSpecification {
  const p = PALETTES[theme];
  const modern = options.modern ? "visible" : "none";
  const labels = options.compact ? "none" : "visible";
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      omt: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution: "© OpenStreetMap contributors, OpenFreeMap",
      },
      ...(options.relief === false ? {} : reliefSources()),
      regions: { type: "geojson", data: "/geo/regions.geojson" },
      marine: { type: "geojson", data: "/geo/marine.geojson" },
      rivers: { type: "geojson", data: "/geo/rivers.geojson", attribution: "Natural Earth" },
      cities: { type: "geojson", data: "/geo/cities.geojson" },
    },
    layers: [
      { id: "land", type: "background", paint: { "background-color": p.land } },
      ...(options.relief === false ? [] : reliefLayers(theme)),
      {
        id: "sand",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "sand"],
        paint: { "fill-color": p.sand, "fill-opacity": 0.55 },
      },
      {
        id: "ice",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "ice"],
        paint: { "fill-color": p.ice, "fill-opacity": 0.8 },
      },
      {
        id: "water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        paint: { "fill-color": p.water, "fill-outline-color": p.waterLine },
      },
      {
        id: "rivers-ne",
        type: "line",
        source: "rivers",
        maxzoom: 8,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": p.river,
          // Bigger rivers (low scalerank) are drawn wider.
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            ["max", 0.4, ["-", 2.2, ["*", 0.25, ["coalesce", ["get", "scalerank"], 6]]]],
            7,
            ["max", 0.8, ["-", 3.6, ["*", 0.3, ["coalesce", ["get", "scalerank"], 6]]]],
          ],
          "line-opacity": p.riverOpacity,
        },
      },
      {
        id: "rivers-osm",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        minzoom: 7,
        filter: ["==", ["get", "class"], "river"],
        paint: {
          "line-color": p.river,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.8, 12, 2.5],
          "line-opacity": p.riverOpacity,
        },
      },
      {
        id: "modern-borders",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
        layout: { visibility: modern },
        paint: {
          "line-color": p.border,
          "line-width": 0.7,
          "line-dasharray": [4, 2],
          "line-opacity": 0.7,
        },
      },
      {
        id: "marine-labels",
        type: "symbol",
        source: "marine",
        layout: {
          visibility: labels,
          "text-field": ["get", "name"],
          "text-font": FONT_ITALIC,
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 11, 6, 14],
          "text-letter-spacing": 0.12,
          "text-max-width": 8,
        },
        paint: { "text-color": p.marineLabel, "text-halo-color": p.water, "text-halo-width": 0.5 },
      },
      {
        id: "river-labels",
        type: "symbol",
        source: "rivers",
        minzoom: 4,
        filter: ["<=", ["coalesce", ["get", "scalerank"], 9], ["step", ["zoom"], 3, 5, 5, 6, 7]],
        layout: {
          visibility: labels,
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-font": FONT_ITALIC,
          "text-size": 11,
          "text-letter-spacing": 0.05,
          "symbol-spacing": 400,
        },
        paint: { "text-color": p.riverLabel, "text-halo-color": p.halo, "text-halo-width": 1.2 },
      },
      {
        id: "region-labels",
        type: "symbol",
        source: "regions",
        // Natural Earth's scalerank orders features by importance: more appear as you zoom in.
        filter: [
          "<=",
          ["coalesce", ["get", "scalerank"], 9],
          ["step", ["zoom"], 3, 4.2, 4, 5.2, 5],
        ],
        layout: {
          visibility: labels,
          "text-field": ["get", "name"],
          "text-font": FONT_REGULAR,
          "text-transform": "uppercase",
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            ["match", ["coalesce", ["get", "scalerank"], 5], 1, 13, 2, 12, 3, 11, 10],
            7,
            14,
          ],
          "text-letter-spacing": 0.22,
          "text-max-width": 7,
          "symbol-sort-key": ["coalesce", ["get", "scalerank"], 9],
        },
        paint: {
          "text-color": p.regionLabel,
          "text-halo-color": p.halo,
          "text-halo-width": 1.2,
          "text-opacity": 0.85,
        },
      },
      {
        id: "modern-cities",
        type: "circle",
        source: "cities",
        filter: [
          "<=",
          ["coalesce", ["get", "scalerank"], 9],
          ["step", ["zoom"], 2, 4, 3, 5, 4, 6, 5],
        ],
        layout: { visibility: modern },
        paint: { "circle-radius": 2.2, "circle-color": p.city, "circle-opacity": 0.8 },
      },
      {
        id: "modern-city-labels",
        type: "symbol",
        source: "cities",
        filter: [
          "<=",
          ["coalesce", ["get", "scalerank"], 9],
          ["step", ["zoom"], 2, 4, 3, 5, 4, 6, 5],
        ],
        layout: {
          visibility: modern,
          "text-field": ["get", "name"],
          "text-font": FONT_REGULAR,
          "text-size": 10.5,
          "text-offset": [0, 0.7],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: {
          "text-color": p.cityLabel,
          "text-halo-color": p.halo,
          "text-halo-width": 1,
          "text-opacity": 0.85,
        },
      },
      {
        id: "modern-places-osm",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        minzoom: 7,
        filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
        layout: {
          visibility: modern,
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": FONT_REGULAR,
          "text-size": 11,
        },
        paint: {
          "text-color": p.cityLabel,
          "text-halo-color": p.halo,
          "text-halo-width": 1,
          "text-opacity": 0.8,
        },
      },
    ],
  } as StyleSpecification;
}

export { FONT_BOLD, FONT_ITALIC, FONT_REGULAR };
