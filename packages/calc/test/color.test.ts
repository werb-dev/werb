import { describe, it, expect } from "vitest";
import { computeColor } from "../src/color.js";

describe("computeColor — Morey", () => {
  it("computes a textbook example: 5 kg pale malt @ 4 SRM, 19 L → ~3.6 SRM", () => {
    const out = computeColor({
      batch_size_l: 19,
      fermentables: [{ name: "Pale", mass_kg: 5, color_srm: 4 }],
    });
    // 5 kg = 11.023 lb; 19 L = 5.019 gal
    // MCU = 11.023 × 4 / 5.019 = 8.78
    // SRM = 1.4922 × 8.78^0.6859 = 1.4922 × 4.466 = 6.66
    expect(out.method).toBe("Morey");
    expect(out.mcu).toBeCloseTo(8.78, 1);
    expect(out.srm).toBeCloseTo(6.66, 1);
    expect(out.ebc).toBeCloseTo(out.srm * 1.97, 4);
  });

  it("sums multiple grains correctly", () => {
    const single = computeColor({
      batch_size_l: 20,
      fermentables: [{ mass_kg: 5, color_srm: 4 }, { mass_kg: 0.5, color_srm: 60 }],
    });
    const split = computeColor({
      batch_size_l: 20,
      fermentables: [
        { mass_kg: 2.5, color_srm: 4 },
        { mass_kg: 2.5, color_srm: 4 },
        { mass_kg: 0.5, color_srm: 60 },
      ],
    });
    expect(single.mcu).toBeCloseTo(split.mcu, 6);
    expect(single.srm).toBeCloseTo(split.srm, 6);
  });

  it("more dark malt → darker beer (monotonicity)", () => {
    const lighter = computeColor({
      batch_size_l: 20,
      fermentables: [{ mass_kg: 5, color_srm: 4 }, { mass_kg: 0.1, color_srm: 200 }],
    });
    const darker = computeColor({
      batch_size_l: 20,
      fermentables: [{ mass_kg: 5, color_srm: 4 }, { mass_kg: 0.5, color_srm: 200 }],
    });
    expect(darker.srm).toBeGreaterThan(lighter.srm);
  });

  it("rejects unimplemented methods", () => {
    expect(() =>
      computeColor({
        method: "Daniels",
        batch_size_l: 20,
        fermentables: [{ mass_kg: 5, color_srm: 4 }],
      }),
    ).toThrow(/not implemented/);
  });
});
