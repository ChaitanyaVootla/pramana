import { describe, expect, it } from "vitest";
import {
  cleanArtist,
  classifyCommonsLicense,
  isUnknownArtist,
  commonsDateToEdtf,
  commonsSrcSet,
  commonsThumbUrl,
  htmlToPlainText,
  mediaAttribution,
  normalizeFileTitle,
  parseCommonsImageInfo,
} from "./media";

describe("classifyCommonsLicense", () => {
  const ok = (fields: Parameters<typeof classifyCommonsLicense>[0]) => {
    const v = classifyCommonsLicense(fields);
    if (!v.ok) throw new Error(`refused: ${v.reason}`);
    return v.license;
  };
  const refused = (fields: Parameters<typeof classifyCommonsLicense>[0]) => {
    const v = classifyCommonsLicense(fields);
    expect(v.ok).toBe(false);
    return v.ok ? "" : v.reason;
  };

  it("accepts CC BY-SA and CC BY with versions and ports", () => {
    expect(ok({ license: "cc-by-sa-4.0", shortName: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0" })).toMatchObject({
      family: "cc_by_sa",
      spdx: "CC-BY-SA-4.0",
      attributionRequired: true,
    });
    expect(ok({ license: "cc-by-2.0", shortName: "CC BY 2.0" }).spdx).toBe("CC-BY-2.0");
    expect(ok({ license: "cc-by-sa-3.0-de", shortName: "CC BY-SA 3.0 de" }).spdx).toBe("CC-BY-SA-3.0-DE");
    expect(ok({ license: "cc-by-sa-3.0-migrated", shortName: "CC BY-SA 3.0" }).spdx).toBe("CC-BY-SA-3.0");
    expect(ok({ license: "cc-by-sa-2.5,2.0,1.0", shortName: "CC BY-SA 2.5" }).spdx).toBe("CC-BY-SA-2.5");
    expect(ok({ license: "", shortName: "CC BY 4.0" }).family).toBe("cc_by");
    expect(ok({ license: "fal", shortName: "FAL" })).toMatchObject({ family: "cc_by_sa", attributionRequired: true });
  });

  it("accepts public domain and CC0, recording the tags as the basis", () => {
    const pd = ok({ license: "pd", shortName: "Public domain", attributionRequired: "false", categories: "Lion Capital of Ashoka|PD India|PD US expired" });
    expect(pd).toMatchObject({ family: "public_domain", attributionRequired: false });
    expect(pd.basis).toBe("Commons licence tags: PD India; PD US expired");
    expect(ok({ license: "cc0", shortName: "CC0" })).toMatchObject({ family: "cc0", spdx: "CC0-1.0" });
    expect(ok({ license: "pd-old-100", shortName: "Public domain" }).family).toBe("public_domain");
  });

  it("refuses NC, ND, fair use, GFDL-only and unknown licences", () => {
    expect(refused({ license: "cc-by-nc-sa-4.0", shortName: "CC BY-NC-SA 4.0" })).toMatch(/restricted/);
    expect(refused({ license: "cc-by-nd-4.0", shortName: "CC BY-ND 4.0" })).toMatch(/restricted/);
    expect(refused({ shortName: "Creative Commons Attribution-NonCommercial 2.0", usageTerms: "Attribution-NonCommercial" })).toMatch(/restricted/);
    expect(refused({ license: "fair use", shortName: "Fair use" })).toMatch(/restricted/);
    expect(refused({ license: "cc-by-sa-4.0", shortName: "CC BY-SA 4.0", nonFree: "true" })).toMatch(/non-free/);
    expect(refused({ license: "gfdl", shortName: "GFDL" })).toMatch(/GFDL/);
    expect(refused({ license: "", shortName: "" })).toMatch(/no licence/);
    expect(refused({ license: "arr", shortName: "Some licence" })).toMatch(/unrecognised/);
  });
});

describe("Commons metadata parsing", () => {
  // Trimmed from a real API response (File:Lion capital of Ashoka, Sarnath.jpg).
  const page = {
    pageid: 121473829,
    ns: 6,
    title: "File:Lion capital of Ashoka, Sarnath.jpg",
    imagerepository: "local",
    imageinfo: [
      {
        timestamp: "2022-08-07T15:52:29Z",
        size: 3023872,
        width: 1920,
        height: 2560,
        url: "https://upload.wikimedia.org/wikipedia/commons/e/e6/Lion_capital_of_Ashoka%2C_Sarnath.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        descriptionurl: "https://commons.wikimedia.org/wiki/File:Lion_capital_of_Ashoka,_Sarnath.jpg",
        sha1: "df56313a593f7c28a926df114e8e77380f3c5d0e",
        mime: "image/jpeg",
        extmetadata: {
          Categories: { value: "Lion Capital of Ashoka|Sarnath Museum|Flickr images reviewed by FlickreviewR 2" },
          ImageDescription: { value: "Lion capital of Ashoka, Sarnath" },
          DateTimeOriginal: { value: "2020-02-18" },
          Credit: {
            value:
              '<a rel="mw:ExtLink nofollow" href="https://www.flickr.com/photos/61856099@N00/49645065441/" class="external free">https://www.flickr.com/photos/61856099@N00/49645065441/</a>',
          },
          Artist: { value: '<a href="//www.flickr.com/people/61856099@N00">lisa&nbsp;bat</a>' },
          LicenseShortName: { value: "CC BY 2.0" },
          UsageTerms: { value: "Creative Commons Attribution 2.0" },
          AttributionRequired: { value: "true" },
          LicenseUrl: { value: "https://creativecommons.org/licenses/by/2.0" },
          License: { value: "cc-by-2.0" },
        },
      },
    ],
  };

  it("parses a file: clean URLs, plain-text author and credit, licence, date", () => {
    const f = parseCommonsImageInfo(page);
    expect(f.fileTitle).toBe("File:Lion capital of Ashoka, Sarnath.jpg");
    expect(f.originalUrl).toBe("https://upload.wikimedia.org/wikipedia/commons/e/e6/Lion_capital_of_Ashoka%2C_Sarnath.jpg");
    expect(f.pageUrl).toBe("https://commons.wikimedia.org/wiki/File:Lion_capital_of_Ashoka,_Sarnath.jpg");
    expect(f.artist).toBe("lisa bat");
    expect(f.credit).toBe("https://www.flickr.com/photos/61856099@N00/49645065441/");
    expect(f.license).toMatchObject({ ok: true, license: { family: "cc_by", spdx: "CC-BY-2.0", shortName: "CC BY 2.0" } });
    expect(f.date).toEqual({ edtf: "2020-02-18", basis: "Wikimedia Commons file date" });
    expect(f.sha1).toBe("df56313a593f7c28a926df114e8e77380f3c5d0e");
  });

  it("credits the first uploader when the author is given as 'Own work'", () => {
    const own = structuredClone(page) as typeof page & { imageinfo: { user?: string }[] };
    own.imageinfo[0]!.extmetadata.Artist = { value: '<span class="int-own-work" lang="en">Own work</span>' };
    own.imageinfo[0]!.user = "Jordi escarre";
    expect(parseCommonsImageInfo(own).artist).toBe("Jordi escarre");
    expect(parseCommonsImageInfo({ ...own, uploaders: ["Superbenjamin", "RaviC", "Jordi escarre"] }).artist).toBe(
      "Superbenjamin and other contributors",
    );
    expect(parseCommonsImageInfo({ ...own, uploaders: ["Superbenjamin", "Superbenjamin"] }).artist).toBe("Superbenjamin");
  });

  it("throws on a missing file", () => {
    expect(() => parseCommonsImageInfo({ title: "File:Nope.jpg", missing: true })).toThrow(/not found/);
  });

  it("keeps one 'Unknown author' where Commons renders two", () => {
    expect(cleanArtist("Unknown authorUnknown author")).toBe("Unknown author");
    expect(cleanArtist("AnonymousUnknown author")).toBe("Unknown author");
    expect(cleanArtist("Unknown authorUnknown author (Ramnath Photographers, Delhi)")).toBe("Unknown author (Ramnath Photographers, Delhi)");
    expect(isUnknownArtist("Unknown author")).toBe(true);
    expect(cleanArtist("Unknown artistUnknown artist")).toBe("Unknown artist");
    expect(isUnknownArtist("Unknown artist")).toBe(true);
  });

  it("strips HTML and decodes entities", () => {
    expect(htmlToPlainText('<span class="fn">Felice&#32;Beato</span> &amp; <i>Co.</i><br/>1858')).toBe("Felice Beato & Co. 1858");
  });

  it("reads plain Commons dates and leaves prose dates alone", () => {
    expect(commonsDateToEdtf("1930")?.edtf).toBe("1930");
    expect(commonsDateToEdtf("circa 1857")?.edtf).toBe("1857~");
    expect(commonsDateToEdtf("1858-03-01 00:00:00")?.edtf).toBe("1858-03-01");
    expect(commonsDateToEdtf("between 1857 and 1858")).toBeNull();
    expect(commonsDateToEdtf("")).toBeNull();
  });

  it("normalises file titles", () => {
    expect(normalizeFileTitle("Lion_capital_of_Ashoka,_Sarnath.jpg")).toBe("File:Lion capital of Ashoka, Sarnath.jpg");
    expect(normalizeFileTitle("https://commons.wikimedia.org/wiki/File:Lion_capital_of_Ashoka%2C_Sarnath.jpg")).toBe(
      "File:Lion capital of Ashoka, Sarnath.jpg",
    );
    expect(normalizeFileTitle("image:sanchi.jpg")).toBe("File:Sanchi.jpg");
  });
});

describe("thumbnails and credit", () => {
  const jpeg = {
    originalUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e6/Lion_capital_of_Ashoka%2C_Sarnath.jpg",
    width: 1920,
    height: 2560,
    mime: "image/jpeg",
  };
  it("snaps to standard widths and never upscales", () => {
    expect(commonsThumbUrl(jpeg, 600)).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Lion_capital_of_Ashoka%2C_Sarnath.jpg/960px-Lion_capital_of_Ashoka%2C_Sarnath.jpg",
    );
    expect(commonsThumbUrl(jpeg, 1920)).toBe(jpeg.originalUrl);
    expect(commonsThumbUrl({ ...jpeg, width: 743 }, 960)).toBe(jpeg.originalUrl);
    expect(commonsSrcSet({ ...jpeg, width: 743 })).toMatch(/500px-.* 500w, https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/e\/e6\/[^ ]+ 743w$/);
  });
  it("always renders TIFFs as JPEG thumbnails below the original width", () => {
    const tiff = { ...jpeg, originalUrl: jpeg.originalUrl.replace(".jpg", ".tif"), mime: "image/tiff", width: 1000 };
    expect(commonsThumbUrl(tiff, 1280)).toMatch(/\/960px-Lion_capital_of_Ashoka%2C_Sarnath\.tif\.jpg$/);
  });
  it("writes a credit line that names the author and licence", () => {
    expect(
      mediaAttribution({
        artist: "lisa bat",
        license: { shortName: "CC BY 2.0", family: "cc_by" },
        representation: "photograph_of_object",
        repository: "wikimedia-commons",
      }),
    ).toBe("Photo: lisa bat, CC BY 2.0, via Wikimedia Commons");
    expect(
      mediaAttribution({
        artist: null,
        license: { shortName: "Public domain", family: "public_domain" },
        representation: "historical_photograph",
        repository: "wikimedia-commons",
      }),
    ).toBe("Public domain, via Wikimedia Commons");
  });
});
