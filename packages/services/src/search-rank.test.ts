import { describe, expect, it } from "vitest";
import { nameScore, namedMatch, prominenceOf, rankByName } from "./search-rank";
import { looseKey } from "./util";

const ranked = (q: string, rows: Parameters<typeof rankByName>[1]) => rankByName(looseKey(q), rows);
const labels = (rows: { label: string }[]) => rows.map((r) => r.label);

describe("search ranking by name", () => {
  it("scores the whole name, an alias, the start of a name, then a word", () => {
    const q = looseKey("ashoka");
    expect(nameScore(q, "Aśoka")).toBe(3);
    expect(nameScore(q, "Devānaṃpiya", [{ label: "Ashoka" }])).toBe(2.5);
    expect(nameScore(looseKey("chandragupta"), "Chandragupta Maurya")).toBe(2);
    expect(nameScore(looseKey("maurya"), "Chandragupta Maurya")).toBe(1);
    expect(nameScore(q, "Kalinga War")).toBe(0);
  });

  it("puts the entity the query names first, whatever its text rank", () => {
    const rows = [
      { label: "Kandahar Bilingual Rock Inscription", rank: 0.6 },
      { label: "Aśoka", rank: 0.1 },
    ];
    expect(labels(ranked("ashoka", rows))).toEqual(["Aśoka", "Kandahar Bilingual Rock Inscription"]);
    expect(namedMatch(looseKey("ashoka"), ranked("ashoka", rows))?.label).toBe("Aśoka");
  });

  it("matches a place by its modern name", () => {
    const rows = [
      { label: "Maurya Empire", rank: 0.5 },
      { label: "Pāṭaliputra", aliases: [{ label: "Patna" }], rank: 0.1 },
    ];
    expect(namedMatch(looseKey("patna"), ranked("patna", rows))?.label).toBe("Pāṭaliputra");
    expect(namedMatch(looseKey("pataliputra"), ranked("pataliputra", rows))?.label).toBe("Pāṭaliputra");
  });

  it("breaks ties between names that answer equally by how much the site has on each", () => {
    const rows = [
      { label: "Gupta era", rank: 0.2, prominence: prominenceOf({ subject: false, pages: 1, claims: 2 }) },
      { label: "Gupta Empire", rank: 0.1, prominence: prominenceOf({ subject: true, pages: 2, claims: 10 }) },
    ];
    expect(namedMatch(looseKey("gupta"), ranked("gupta", rows))?.label).toBe("Gupta Empire");
  });

  it("never lets prominence lift a weaker name above a better one", () => {
    const rows = [
      { label: "Kalinga War", rank: 0.3, prominence: 1 },
      { label: "Kalinga", rank: 0, prominence: 0 },
    ];
    expect(labels(ranked("kalinga", rows))[0]).toBe("Kalinga");
  });

  it("names no match for a word inside a name, or a very short query", () => {
    expect(namedMatch(looseKey("empire"), ranked("empire", [{ label: "Maurya Empire", rank: 0.5 }]))).toBeNull();
    expect(namedMatch(looseKey("as"), ranked("as", [{ label: "Aśoka", rank: 0.5 }]))).toBeNull();
    expect(namedMatch("x", [])).toBeNull();
  });

  it("keeps prominence between 0 and 1", () => {
    expect(prominenceOf({ subject: false, pages: 0, claims: 0 })).toBe(0);
    expect(prominenceOf({ subject: true, pages: 50, claims: 500 })).toBeCloseTo(1);
  });
});
