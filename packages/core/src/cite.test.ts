import { describe, expect, it } from "vitest";
import { fullCitation, shortCitation } from "./cite";

describe("fullCitation", () => {
  it("leads with the author and year", () => {
    expect(
      fullCitation({ type: "book", title: "Inscriptions of Asoka", author: [{ family: "Hultzsch", given: "E." }], issued: { "date-parts": [[1925]] }, publisher: "Clarendon Press", "publisher-place": "Oxford" }),
    ).toBe("E. Hultzsch (1925). *Inscriptions of Asoka*. Oxford: Clarendon Press.");
  });
  it("leads with the title when there is no author, year last", () => {
    expect(fullCitation({ type: "entry-encyclopedia", title: "Arthashastra", "container-title": "Wikipedia", issued: { "date-parts": [[2026]] } })).toBe(
      "*Arthashastra*. In *Wikipedia*. 2026.",
    );
  });
  it("names translators", () => {
    expect(fullCitation({ type: "book", title: "Ancient India", translator: [{ family: "McCrindle", given: "J. W." }], issued: { "date-parts": [[1877]] } })).toBe(
      "*Ancient India*. Translated by J. W. McCrindle. 1877.",
    );
    expect(shortCitation({ type: "book", title: "Ancient India", translator: [{ family: "McCrindle", given: "J. W." }], issued: { "date-parts": [[1877]] } })).toBe("McCrindle 1877");
  });
});
