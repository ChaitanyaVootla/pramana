import { describe, expect, it } from "vitest";
import { orderForReview } from "./review";

describe("orderForReview", () => {
  it("puts each proposal after the waiting ones it builds on", () => {
    const cs = [
      { id: "03", dependsOn: ["01", "02"], status: "proposed" },
      { id: "01", dependsOn: [], status: "proposed" },
      { id: "02", dependsOn: ["00"], status: "proposed" },
      { id: "00", dependsOn: [], status: "applied" },
    ];
    const order = orderForReview(cs);
    expect(order.map((o) => o.item.id)).toEqual(["01", "02", "03"]);
    expect(order.find((o) => o.item.id === "02")!.ready).toBe(true); // its dependency is already applied
    expect(order.find((o) => o.item.id === "03")!.waitingOn.map((d) => d.id)).toEqual(["01", "02"]);
  });
});
