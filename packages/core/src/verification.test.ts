import { describe, expect, it } from "vitest";
import { ClaimSupportCheck } from "./records";
import { claimLevel, effectiveSupportStatus, jointSupportState, supportCheckState, type CitationEvidence } from "./verification";

const A = "01a149c7-0000-7000-8000-00000000000a";
const B = "01a149c7-0000-7000-8000-00000000000b";
const C = "01a149c7-0000-7000-8000-00000000000c";
const SHA = "a".repeat(64);

function cite(id: string, over: Partial<CitationEvidence> = {}): CitationEvidence {
  return {
    id,
    stance: "supports",
    excerptStatus: "exact",
    supportStatus: "ai_partial",
    sourceId: `s-${id}`,
    sourceTier: "primary",
    ...over,
  };
}

describe("claimLevel with a joint support check", () => {
  const parts = [cite(A), cite(B)];

  it("stays at L2 when every citation is only partial", () => {
    expect(claimLevel(parts)).toBe(2);
  });

  it("reaches L3 when a current AI joint check says supports", () => {
    expect(claimLevel(parts, { status: "ai_supports", citationIds: [A, B], current: true })).toBe(3);
  });

  it("reaches L4 only from a person's joint confirmation", () => {
    expect(claimLevel(parts, { status: "human_confirmed", citationIds: [A, B], current: true })).toBe(4);
  });

  it("ignores a stale, partial or unsupported joint check", () => {
    expect(claimLevel(parts, { status: "ai_supports", citationIds: [A, B], current: false })).toBe(2);
    expect(claimLevel(parts, { status: "ai_partial", citationIds: [A, B], current: true })).toBe(2);
    expect(claimLevel(parts, { status: "ai_unsupported", citationIds: [A, B], current: true })).toBe(2);
  });

  it("requires every considered quote to be verified and evidential", () => {
    const unverified = [cite(A), cite(B, { excerptStatus: "not_found" })];
    expect(claimLevel(unverified, { status: "ai_supports", citationIds: [A, B], current: true })).toBe(2);
    const mention = [cite(A), cite(B, { stance: "mentions" })];
    expect(claimLevel(mention, { status: "ai_supports", citationIds: [A, B], current: true })).toBe(2);
    const rejected = [cite(A), cite(B, { supportStatus: "human_rejected" })];
    expect(claimLevel(rejected, { status: "ai_supports", citationIds: [A, B], current: true })).toBe(2);
    expect(claimLevel(parts, { status: "ai_supports", citationIds: [A, C], current: true })).toBe(2);
  });

  it("never lowers a level a single citation already reaches", () => {
    const confirmed = [cite(A, { supportStatus: "human_confirmed" }), cite(B)];
    expect(claimLevel(confirmed, { status: "ai_supports", citationIds: [A, B], current: true })).toBe(4);
  });
});

describe("jointSupportState", () => {
  const check = { basis: { textSha256: SHA, citationIds: [A, B] } };

  it("is current while the text and the set of citations are unchanged, in any order", () => {
    expect(jointSupportState(check, { textSha256: SHA, citationIds: [B, A] })).toBe("current");
  });

  it("goes stale when the text changes or a citation is added or removed", () => {
    expect(jointSupportState(check, { textSha256: "b".repeat(64), citationIds: [A, B] })).toBe("stale");
    expect(jointSupportState(check, { textSha256: SHA, citationIds: [A, B, C] })).toBe("stale");
    expect(jointSupportState(check, { textSha256: SHA, citationIds: [A] })).toBe("stale");
  });
});

describe("ClaimSupportCheck", () => {
  it("validates a joint judgment and refuses an unchecked one", () => {
    const ok = {
      status: "ai_supports",
      by: A,
      at: new Date().toISOString(),
      note: "Together the quotes give the date and the number.",
      citationIds: [A, B],
      basis: { textSha256: SHA, citationIds: [A, B] },
    };
    expect(ClaimSupportCheck.safeParse(ok).success).toBe(true);
    expect(ClaimSupportCheck.safeParse({ ...ok, status: "unchecked" }).success).toBe(false);
    expect(ClaimSupportCheck.safeParse({ ...ok, citationIds: [] }).success).toBe(false);
  });
});

describe("supportCheckState", () => {
  const basis = { claimTextSha256: SHA, excerptId: A, quoteSha256: "c".repeat(64), stance: "supports" };

  it("is current while claim text, excerpt, quote and stance are unchanged", () => {
    expect(supportCheckState({ status: "ai_supports", basis }, { ...basis })).toBe("current");
  });

  it("goes stale when any of them changes", () => {
    expect(supportCheckState({ status: "ai_supports", basis }, { ...basis, claimTextSha256: "b".repeat(64) })).toBe("stale");
    expect(supportCheckState({ status: "ai_supports", basis }, { ...basis, excerptId: B })).toBe("stale");
    expect(supportCheckState({ status: "ai_supports", basis }, { ...basis, quoteSha256: null })).toBe("stale");
    expect(supportCheckState({ status: "ai_supports", basis }, { ...basis, stance: "qualifies" })).toBe("stale");
  });

  it("treats unchecked citations and judgments without a basis as current", () => {
    expect(supportCheckState({ status: "unchecked" }, basis)).toBe("current");
    expect(supportCheckState({ status: "ai_partial" }, basis)).toBe("current");
  });

  it("makes a stale judgment count as unchecked for the level", () => {
    const status = effectiveSupportStatus("ai_supports", "stale");
    expect(claimLevel([cite(A, { supportStatus: status })])).toBe(2);
    expect(claimLevel([cite(A, { supportStatus: effectiveSupportStatus("ai_supports", "current") })])).toBe(3);
  });
});
