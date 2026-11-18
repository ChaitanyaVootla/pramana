import { describe, expect, it } from "vitest";
import { AtlasSpec, PageSpec } from "./pagespec";
import {
  applyUserView,
  describeUserView,
  describeViewChange,
  EMPTY_VIEW,
  isEmptyView,
  patchUserView,
  UserView,
  UserViewChange,
} from "./userview";

const era = PageSpec.parse({
  atlas: AtlasSpec.parse({
    stops: [
      { year: -321, label: "Chandragupta takes power" },
      { year: -260, label: "Kalinga conquered" },
    ],
  }),
});

describe("user view validation", () => {
  it("fills defaults and refuses unknown panels", () => {
    expect(UserView.parse({})).toEqual(EMPTY_VIEW);
    expect(isEmptyView(UserView.parse({}))).toBe(true);
    expect(UserView.safeParse({ hide: ["sidebar-ads"] }).success).toBe(false);
    expect(UserView.safeParse({ reading: "speed" }).success).toBe(false);
    expect(UserView.safeParse({ highlights: [{ claimId: "nope" }] }).success).toBe(false);
    expect(UserView.safeParse({ emphasis: ["asoka", "kalinga"] }).success).toBe(true);
  });

  it("validates a recorded change", () => {
    const change = {
      at: new Date().toISOString(),
      by: { kind: "agent", handle: "claude-code", name: "claude-code" },
      note: "You mixed up the two Chandraguptas",
      before: EMPTY_VIEW,
    };
    expect(UserViewChange.safeParse(change).success).toBe(true);
    expect(UserViewChange.safeParse({ ...change, by: { kind: "robot" } }).success).toBe(false);
  });
});

describe("patching a view", () => {
  it("changes only the keys given", () => {
    const v = patchUserView(EMPTY_VIEW, { hide: ["notes"], atlas: { modernLabels: true } });
    const w = patchUserView(v, { reading: "skim" });
    expect(w.hide).toEqual(["notes"]);
    expect(w.atlas.modernLabels).toBe(true);
    expect(w.reading).toBe("skim");
  });

  it("keeps the appearance choices for the site-wide view", () => {
    const v = patchUserView(EMPTY_VIEW, { appearance: { text: "large" } });
    expect(v.appearance).toEqual({ text: "large", width: "standard", density: "standard" });
    const w = patchUserView(v, { appearance: { theme: "dark", density: "full" } });
    expect(w.appearance).toEqual({ text: "large", width: "standard", density: "full", theme: "dark" });
    expect(describeUserView(w)).toEqual(["Larger text", "Shows quotations and checks in the text", "Dark theme"]);
    expect(patchUserView(w, { appearance: { theme: null } }).appearance?.theme).toBeUndefined();
    expect(isEmptyView(patchUserView(w, { appearance: null }))).toBe(true);
    expect(UserView.safeParse({ appearance: { text: "huge" } }).success).toBe(false);
  });

  it("clears a setting with null", () => {
    const v = patchUserView(EMPTY_VIEW, { reading: "full", atlas: { initialYear: -260 } });
    const w = patchUserView(v, { reading: null, atlas: { initialYear: null } });
    expect(w.reading).toBeUndefined();
    expect(w.atlas.initialYear).toBeUndefined();
    expect(isEmptyView(w)).toBe(true);
  });
});

describe("a user view over a page spec", () => {
  it("leaves the spec alone when there is no view", () => {
    expect(applyUserView(era, null)).toBe(era);
  });

  it("hides panels, and the outline", () => {
    const out = applyUserView(era, UserView.parse({ hide: ["already_know", "notes", "outline"] }));
    expect(out.hero.panels).toEqual(["media"]);
    expect(out.rail.panels).toEqual(["atlas", "in_this_part"]);
    expect(out.outline).toBe("none");
  });

  it("reorders the rail and shows a panel the page leaves out", () => {
    const out = applyUserView(era, UserView.parse({ railOrder: ["notes"], show: ["timeline"] }));
    expect(out.rail.panels).toEqual(["notes", "atlas", "in_this_part", "timeline"]);
  });

  it("starts from the spec's own panels when it names them", () => {
    const spec = PageSpec.parse({ rail: { panels: ["timeline", "notes"] }, hero: { panels: ["atlas"] } });
    const out = applyUserView(spec, UserView.parse({ railOrder: ["notes", "in_this_part"] }));
    expect(out.rail.panels).toEqual(["notes", "timeline"]);
    expect(out.hero.panels).toEqual(["atlas"]);
  });

  it("changes which turning points the map shows, its year and its names", () => {
    const out = applyUserView(
      era,
      UserView.parse({
        atlas: {
          hideStops: [-321],
          stops: [{ year: -250, label: "Third council" }],
          initialYear: -260,
          modernLabels: true,
        },
      }),
    );
    expect(out.atlas!.stops.map((s) => s.year)).toEqual([-260, -250]);
    expect(out.atlas!.initialYear).toBe(-260);
    expect(out.atlas!.modernLabels).toBe(true);
    // The page's own spec is not touched.
    expect(era.atlas!.stops).toHaveLength(2);
    expect(era.atlas!.modernLabels).toBe(false);
  });

  it("does not invent an atlas for a page without one", () => {
    const plain = PageSpec.parse({});
    expect(applyUserView(plain, UserView.parse({ atlas: { modernLabels: true } })).atlas).toBeUndefined();
    expect(applyUserView(plain, UserView.parse({})).rail.panels).toEqual(["timeline", "in_this_part", "notes"]);
  });

  it("keeps the merged spec valid", () => {
    const out = applyUserView(era, UserView.parse({ hide: ["atlas", "media"], show: ["timeline"] }));
    expect(PageSpec.safeParse(out).success).toBe(true);
  });
});

describe("saying what a view does", () => {
  it("lists changes in plain words", () => {
    const v = UserView.parse({ hide: ["atlas", "notes"], reading: "skim", emphasis: ["asoka"] });
    expect(describeUserView(v)).toEqual([
      "Hides the map and study notes",
      "Opens on the short versions",
      "Brings out 1 name",
    ]);
    expect(describeUserView(EMPTY_VIEW)).toEqual([]);
  });

  it("describes one change, and a reset", () => {
    const before = UserView.parse({ reading: "skim" });
    const after = UserView.parse({ reading: "skim", foldKnown: true });
    expect(describeViewChange(before, after)).toEqual(["Keeps parts you have read folded"]);
    expect(describeViewChange(after, EMPTY_VIEW)).toEqual(["Put the page back as published"]);
  });
});
