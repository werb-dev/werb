import { describe, it, expect } from "vitest";
import {
  CULTURES,
  FERMENTABLES,
  HOPS,
  MISCS,
  searchCultures,
  searchFermentables,
  searchHops,
  searchMiscs,
} from "../src/data/catalog/index.ts";

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

  it("caps results at 10", () => {
    // Lots of grain entries; query "malt" matches ~30+. Should still be capped.
    expect(searchFermentables("malt").length).toBeLessThanOrEqual(10);
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

  it("respects max-results cap", () => {
    expect(searchCultures("e").length).toBeLessThanOrEqual(10);
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
