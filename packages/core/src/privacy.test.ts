import { describe, expect, it } from "vitest";
import { aggregate, MIN_GROUP } from "./privacy";

describe("aggregate (k-anonymity)", () => {
  it("withholds values from fewer than k learners but keeps the counts", () => {
    let computed = false;
    const a = aggregate(12, MIN_GROUP - 1, () => ((computed = true), 0.5));
    expect(a).toEqual({ responses: 12, learners: 4, value: null });
    expect(computed).toBe(false);
  });
  it("shows values from k or more learners", () => {
    expect(aggregate(9, MIN_GROUP, () => 0.25)).toEqual({ responses: 9, learners: 5, value: 0.25 });
    expect(aggregate(3, 3, () => 1, 3).value).toBe(1);
  });
});
