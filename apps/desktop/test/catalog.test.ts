import { describe, it, expect } from "vitest";
import {
  CULTURES,
  FERMENTABLES,
  HOPS,
  MISCS,
  SOURCE_WATER_PROFILES,
  STYLES,
  searchCultures,
  searchFermentables,
  searchHops,
  searchMiscs,
  searchStyles,
} from "../src/data/catalog/index.ts";
import { computeWaterAdditions } from "@werb/calc";

describe("catalog content sanity", () => {
  it("ships at least 50 fermentables with required fields", () => {
    expect(FERMENTABLES.length).toBeGreaterThanOrEqual(50);
    for (const f of FERMENTABLES) {
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.color_ebc).toBeGreaterThanOrEqual(0);
      expect(f.yield_pct).toBeGreaterThanOrEqual(0);
    }
  });

  it("ships at least 50 hops, all with non-negative alpha", () => {
    expect(HOPS.length).toBeGreaterThanOrEqual(50);
    for (const h of HOPS) {
      expect(h.name.length).toBeGreaterThan(0);
      expect(h.alpha_acid_pct).toBeGreaterThan(0);
    }
  });

  it("ships at least 50 cultures with package size + attenuation", () => {
    expect(CULTURES.length).toBeGreaterThanOrEqual(50);
    for (const c of CULTURES) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.attenuation_pct).toBeGreaterThan(0);
      expect(c.default_amount).toBeGreaterThan(0);
      expect(["g", "ml", "pkg"]).toContain(c.default_amount_unit);
    }
  });

  it("ships at least 20 miscs with default use + amount", () => {
    expect(MISCS.length).toBeGreaterThanOrEqual(20);
    for (const m of MISCS) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.default_amount).toBeGreaterThan(0);
      expect(["g", "kg", "ml", "l"]).toContain(m.default_amount_unit);
    }
  });

  it("includes the French hops we explicitly curated", () => {
    const names = HOPS.map((h) => h.name);
    expect(names).toEqual(expect.arrayContaining([
      "Strisselspalt",
      "Aramis",
      "Triskel",
      "Barbe Rouge",
      "Mistral",
      "Elixir",
    ]));
  });

  it("ships kveik strains and Belgian saison strains for the modern brewer", () => {
    const cultureNames = CULTURES.map((c) => c.name);
    expect(cultureNames).toEqual(expect.arrayContaining([
      "LalBrew Voss Kveik",
      "LalBrew Belle Saison",
    ]));
  });
});

describe("catalog search — fermentables", () => {
  it("matches a prefix and ranks it above an internal substring", () => {
    const out = searchFermentables("pils");
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]?.name.toLowerCase().startsWith("pils")).toBe(true);
  });

  it("matches by producer name", () => {
    const out = searchFermentables("weyermann");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((f) => f.producer === "Weyermann")).toBe(true);
  });

  it("returns empty for a query with no matches", () => {
    expect(searchFermentables("zzzzzzzz")).toEqual([]);
  });

  it("returns every match, not a 10-item cap", () => {
    // Lots of grain entries match "malt". Brewers were losing matches
    // past row 10; the dropdown is scrollable, so return the full set.
    const out = searchFermentables("malt");
    expect(out.length).toBeGreaterThan(10);
    expect(out.every((f) => /malt/i.test(f.name) || /malt/i.test(f.producer ?? ""))).toBe(true);
  });

  it("ranks prefix matches above interior matches", () => {
    // "ext" should put fermentables whose name starts with "Ext…"
    // ahead of those that merely contain "…ext…".
    const out = searchFermentables("ext");
    const firstStarts = out.findIndex((f) => /^ext/i.test(f.name));
    const firstContains = out.findIndex((f) => /^(?!ext).*ext/i.test(f.name));
    if (firstStarts !== -1 && firstContains !== -1) {
      expect(firstStarts).toBeLessThan(firstContains);
    }
  });
});

describe("catalog search — hops", () => {
  it("matches by exact French hop name", () => {
    const out = searchHops("strissel");
    expect(out.some((h) => h.name === "Strisselspalt")).toBe(true);
  });

  it("matches by origin", () => {
    const out = searchHops("FR");
    // The search indexes name + origin, so a few non-FR hops with "fr" in
    // their name (e.g. "First Gold") may show up. We just want to confirm
    // the French varieties surface as expected.
    expect(out.some((h) => h.origin === "FR")).toBe(true);
  });

  it("ranks prefix-match above mid-match", () => {
    const out = searchHops("cas");
    expect(out[0]?.name.toLowerCase().startsWith("cas")).toBe(true);
  });
});

describe("catalog search — cultures", () => {
  it("finds Safale US-05 by product id", () => {
    const out = searchCultures("US-05");
    expect(out.some((c) => c.product_id === "US-05")).toBe(true);
  });

  it("finds wyeast strains by producer", () => {
    const out = searchCultures("wyeast");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => c.producer === "Wyeast")).toBe(true);
  });

  it("returns every match (no hard cap)", () => {
    expect(searchCultures("e").length).toBeGreaterThan(10);
  });
});

describe("catalog search — miscs", () => {
  it("finds Irish Moss", () => {
    const out = searchMiscs("irish");
    expect(out.some((m) => m.name === "Irish Moss")).toBe(true);
  });

  it("finds water salts by category", () => {
    const out = searchMiscs("water_agent");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((m) => m.type === "water_agent")).toBe(true);
  });
});

describe("catalog content sanity — styles", () => {
  it("ships the 2021 BJCP guideline coverage we curated", () => {
    expect(STYLES.length).toBeGreaterThanOrEqual(80);
  });

  it("every style has internally-consistent ranges", () => {
    for (const s of STYLES) {
      expect(s.og_min).toBeLessThanOrEqual(s.og_max);
      expect(s.fg_min).toBeLessThanOrEqual(s.fg_max);
      expect(s.ibu_min).toBeLessThanOrEqual(s.ibu_max);
      expect(s.srm_min).toBeLessThanOrEqual(s.srm_max);
      expect(s.abv_min).toBeLessThanOrEqual(s.abv_max);
      expect(s.category_number).toBeGreaterThanOrEqual(1);
      expect(s.category_number).toBeLessThanOrEqual(34);
      expect(s.style_letter.length).toBe(1);
    }
  });

  it("includes the headline IPA / lager / saison styles", () => {
    const names = STYLES.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining([
      "American IPA",
      "Hazy IPA",
      "Double IPA",
      "American Pale Ale",
      "Munich Helles",
      "German Pils",
      "Saison",
      "Belgian Tripel",
      "Imperial Stout",
    ]));
  });
});

describe("catalog — source water profiles", () => {
  it("ships at least the canonical brewing cities", () => {
    const keys = SOURCE_WATER_PROFILES.map((p) => p.key);
    expect(keys).toEqual(
      expect.arrayContaining(["pilsen", "munich", "burton", "dublin", "london"]),
    );
  });

  it("every preset has six finite non-negative ions and a unique key", () => {
    const seenKeys = new Set<string>();
    for (const p of SOURCE_WATER_PROFILES) {
      expect(seenKeys.has(p.key), `duplicate key: ${p.key}`).toBe(false);
      seenKeys.add(p.key);
      for (const v of [p.ca_ppm, p.mg_ppm, p.na_ppm, p.cl_ppm, p.so4_ppm, p.hco3_ppm]) {
        expect(Number.isFinite(v) && v >= 0).toBe(true);
      }
    }
  });

  it("each preset round-trips cleanly through computeWaterAdditions", () => {
    // Catches typos like an Na value parked in the Cl slot: feed the
    // profile into the salt-additions calc with no additions and
    // assert the output ion strip matches the input within rounding.
    for (const p of SOURCE_WATER_PROFILES) {
      const result = computeWaterAdditions({
        water_volume_l: 30,
        source: {
          ca_ppm: p.ca_ppm,
          mg_ppm: p.mg_ppm,
          na_ppm: p.na_ppm,
          cl_ppm: p.cl_ppm,
          so4_ppm: p.so4_ppm,
          hco3_ppm: p.hco3_ppm,
        },
        additions: {},
      });
      expect(result.ca_ppm).toBeCloseTo(p.ca_ppm, 4);
      expect(result.mg_ppm).toBeCloseTo(p.mg_ppm, 4);
      expect(result.so4_ppm).toBeCloseTo(p.so4_ppm, 4);
      expect(result.cl_ppm).toBeCloseTo(p.cl_ppm, 4);
      expect(result.hco3_ppm).toBeCloseTo(p.hco3_ppm, 4);
    }
  });

  it("Burton has dramatically more sulfate than chloride (famous profile)", () => {
    const burton = SOURCE_WATER_PROFILES.find((p) => p.key === "burton")!;
    expect(burton.so4_ppm).toBeGreaterThan(burton.cl_ppm * 10);
  });

  it("RO / distilled has all zeros", () => {
    const ro = SOURCE_WATER_PROFILES.find((p) => p.key === "ro")!;
    const total = ro.ca_ppm + ro.mg_ppm + ro.na_ppm + ro.cl_ppm + ro.so4_ppm + ro.hco3_ppm;
    expect(total).toBe(0);
  });
});

describe("catalog search — styles", () => {
  it("finds American IPA by name", () => {
    const out = searchStyles("american ipa");
    expect(out[0]?.name).toBe("American IPA");
  });

  it("finds a style by its category code (e.g. 21A)", () => {
    const out = searchStyles("21A");
    expect(out.some((s) => s.category_number === 21 && s.style_letter === "A")).toBe(true);
  });

  it("matches on the category name (e.g. Trappist)", () => {
    const out = searchStyles("trappist");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((s) => s.category === "Trappist Ale")).toBe(true);
  });

  it("returns empty for nonsense", () => {
    expect(searchStyles("zzzzzzz")).toEqual([]);
  });

  it("returns every match (no hard cap)", () => {
    expect(searchStyles("ale").length).toBeGreaterThan(10);
  });
});
