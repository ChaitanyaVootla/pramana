import { describe, expect, it } from "vitest";
import { versionedCache } from "./cache";

function setup(maxAgeMs?: number) {
  let version = 1;
  let loads = 0;
  const get = versionedCache(
    (slug: string) => slug,
    async (slug: string) => {
      loads++;
      return { slug, blocks: [{ id: "a" }], loadedAt: loads };
    },
    { version: async () => version, maxAgeMs },
  );
  return { get, bump: () => version++, loads: () => loads };
}

describe("versionedCache", () => {
  it("loads once per key and version, and again after a write", async () => {
    const c = setup();
    await c.get("maurya");
    await c.get("maurya");
    expect(c.loads()).toBe(1);
    await c.get("gupta");
    expect(c.loads()).toBe(2);
    c.bump();
    expect((await c.get("maurya")).loadedAt).toBe(3);
  });

  it("hands out copies, so a caller's change does not reach the next caller", async () => {
    const c = setup();
    const first = await c.get("maurya");
    first.blocks.push({ id: "mutated" });
    expect((await c.get("maurya")).blocks).toEqual([{ id: "a" }]);
  });

  it("shares one load between concurrent calls", async () => {
    const c = setup();
    await Promise.all([c.get("maurya"), c.get("maurya"), c.get("maurya")]);
    expect(c.loads()).toBe(1);
  });

  it("does not keep a failure", async () => {
    let fail = true;
    const get = versionedCache(
      (k: string) => k,
      async (k: string) => {
        if (fail) throw new Error("not found");
        return k;
      },
      { version: async () => 1 },
    );
    await expect(get("x")).rejects.toThrow("not found");
    fail = false;
    await expect(get("x")).resolves.toBe("x");
  });

  it("expires entries", async () => {
    const c = setup(0);
    await c.get("maurya");
    await new Promise((r) => setTimeout(r, 2));
    await c.get("maurya");
    expect(c.loads()).toBe(2);
  });
});
