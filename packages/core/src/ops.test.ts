import { describe, expect, it } from "vitest";
import { ChangesetInput, resolveRefs } from "./ops";

describe("ChangesetInput", () => {
  it("accepts a linked create chain using @refs", () => {
    const parsed = ChangesetInput.parse({
      title: "Kalinga war",
      ops: [
        {
          op: "create_claim",
          ref: "kalinga",
          text: "Kalinga was conquered eight years after Ashoka's consecration.",
          kind: "fact",
        },
        { op: "cite", claim: "@kalinga", excerpt: "@re13", stance: "supports" },
      ],
    });
    expect(parsed.dependsOn).toEqual([]);
  });

  it("rejects malformed refs", () => {
    expect(() =>
      ChangesetInput.parse({
        title: "bad",
        ops: [{ op: "cite", claim: "kalinga", excerpt: "@x", stance: "supports" }],
      }),
    ).toThrow();
  });
});

describe("resolveRefs", () => {
  const refs = new Map([["kalinga", "0199f0a0-0000-7000-8000-000000000001"]]);
  it("rewrites id fields and markdown links", () => {
    const out = resolveRefs(
      { claim: "@kalinga", markdown: "See [the war](claim:@kalinga)." },
      refs,
    );
    expect(out).toEqual({
      claim: "0199f0a0-0000-7000-8000-000000000001",
      markdown: "See [the war](claim:0199f0a0-0000-7000-8000-000000000001).",
    });
  });
  it("reports unknown refs", () => {
    expect(() => resolveRefs({ claim: "@missing" }, refs)).toThrow(/@missing/);
  });
});
