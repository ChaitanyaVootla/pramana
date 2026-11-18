import { describe, expect, it } from "vitest";
import { cliopatriaYearToAstronomical, extentYearsLabel, MultiPolygonGeometry } from "./extents";

describe("cliopatriaYearToAstronomical", () => {
  it("treats negative years as BCE (historical numbering)", () => {
    expect(cliopatriaYearToAstronomical(-318)).toBe(-317);
    expect(cliopatriaYearToAstronomical(-1)).toBe(0);
    expect(cliopatriaYearToAstronomical(1)).toBe(1);
    expect(cliopatriaYearToAstronomical(2024)).toBe(2024);
  });
  it("maps the year 0 Cliopatria uses to close BCE ranges to 1 BCE", () => {
    expect(cliopatriaYearToAstronomical(0)).toBe(0);
  });
  it("labels inclusive ranges in BCE/CE", () => {
    expect(extentYearsLabel(cliopatriaYearToAstronomical(-318), cliopatriaYearToAstronomical(-316))).toBe(
      "318–316 BCE",
    );
    expect(extentYearsLabel(-26, 0)).toBe("27–1 BCE");
    expect(extentYearsLabel(320, 320)).toBe("320 CE");
  });
});

describe("MultiPolygonGeometry", () => {
  const ring = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 0],
  ];
  it("accepts closed rings and rejects open ones", () => {
    expect(MultiPolygonGeometry.safeParse({ type: "MultiPolygon", coordinates: [[ring]] }).success).toBe(true);
    const open = [...ring.slice(0, 3), [0, 1]];
    expect(MultiPolygonGeometry.safeParse({ type: "MultiPolygon", coordinates: [[open]] }).success).toBe(false);
    expect(MultiPolygonGeometry.safeParse({ type: "Polygon", coordinates: [ring] }).success).toBe(false);
  });
});
