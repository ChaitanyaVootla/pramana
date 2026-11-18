import { describe, expect, it } from "vitest";
import { foldForSearch, looseSpelling, toPrefixQuery, withLooseWords } from "./util";

describe("search folding", () => {
  it("meets ASCII spellings and IAST in the same loose form", () => {
    const same = (a: string, b: string) => expect(looseSpelling(foldForSearch(a).split(" ")[0]!)).toBe(looseSpelling(foldForSearch(b).split(" ")[0]!));
    same("ashoka", "Aśoka");
    same("Krishna", "Kṛṣṇa");
    same("chandragupta", "Candragupta");
    same("Pataaliputra", "Pāṭaliputra");
    same("Shiva", "Śiva");
    same("Rigveda", "Ṛgveda");
    same("Chhatrapati", "Chatrapati");
    same("Harappa", "Harappā");
  });

  it("is idempotent", () => {
    for (const w of ["rii", "shri", "aaa", "chhh", "krishnaa", "asoka"]) expect(looseSpelling(looseSpelling(w))).toBe(looseSpelling(w));
    const once = foldForSearch("Aśoka's edicts, Ashoka Maurya");
    expect(withLooseWords(once)).toBe(once);
  });

  it("stores the loose form beside the folded text", () => {
    expect(foldForSearch("Ashoka", "Aśoka")).toBe("ashoka asoka");
    expect(foldForSearch("Kalinga")).toBe("kalinga");
  });

  it("queries both forms, as prefixes", () => {
    expect(toPrefixQuery("ashok kalin")).toBe("(ashok:* | asok:*) & kalin:*");
    expect(toPrefixQuery("Pāṭaliputra")).toBe("pataliputra:*");
    expect(toPrefixQuery("  ")).toBeNull();
  });
});
