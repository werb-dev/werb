import { describe, it, expect } from "vitest";
import {
  DEFAULT_PREFS,
  formatColor,
  formatGravity,
  formatMassLarge,
  formatMassSmall,
  formatTemperature,
  formatVolume,
  formatSrm,
  formatSpecificGravity,
  formatCelsius,
  formatLiters,
  userTempToCelsius,
  userVolumeToLiters,
  userMassLargeToKg,
  userMassSmallToG,
  userColorToSrm,
  kgToUserMassLarge,
  kgToUserMassSmall,
  litersToUserVolume,
  celsiusToUserTemp,
  srmToUserColor,
  type UnitPreferences,
} from "../src/data/units-format.ts";

const METRIC = DEFAULT_PREFS;
const IMPERIAL: UnitPreferences = {
  temperature: "F",
  volume: "gal",
  mass: "lb",
  gravity: "plato",
  color: "SRM",
  currency: "USD",
};

describe("formatTemperature", () => {
  it("returns °C unchanged under metric prefs", () => {
    const f = formatTemperature({ value: 67, unit: "C" }, METRIC);
    expect(f.value).toBe(67);
    expect(f.unit).toBe("°C");
    expect(f.display).toBe("67.0 °C");
  });

  it("converts °C → °F under imperial prefs", () => {
    const f = formatTemperature({ value: 100, unit: "C" }, IMPERIAL);
    expect(f.value).toBe(212);
    expect(f.unit).toBe("°F");
    expect(f.display).toBe("212.0 °F");
  });

  it("handles °F input under metric prefs", () => {
    const f = formatTemperature({ value: 212, unit: "F" }, METRIC);
    expect(f.value).toBeCloseTo(100, 4);
    expect(f.unit).toBe("°C");
  });
});

describe("formatVolume", () => {
  it("L → L under metric", () => {
    const f = formatVolume({ value: 20, unit: "l" }, METRIC);
    expect(f.value).toBe(20);
    expect(f.unit).toBe("L");
    expect(f.display).toBe("20.0 L");
  });

  it("L → US gal under imperial", () => {
    const f = formatVolume({ value: 20, unit: "l" }, IMPERIAL);
    expect(f.value).toBeCloseTo(5.28, 2);
    expect(f.unit).toBe("gal");
    expect(f.display).toMatch(/5\.28 gal/);
  });

  it("normalizes mL to L on the metric side", () => {
    const f = formatVolume({ value: 500, unit: "ml" }, METRIC);
    expect(f.value).toBe(0.5);
  });
});

describe("formatMassLarge", () => {
  it("kg under metric", () => {
    const f = formatMassLarge({ value: 4.5, unit: "kg" }, METRIC);
    expect(f.unit).toBe("kg");
    expect(f.display).toBe("4.50 kg");
  });

  it("kg → lb under imperial", () => {
    const f = formatMassLarge({ value: 1, unit: "kg" }, IMPERIAL);
    expect(f.value).toBeCloseTo(2.2046, 2);
    expect(f.unit).toBe("lb");
  });
});

describe("formatMassSmall", () => {
  it("g under metric", () => {
    const f = formatMassSmall({ value: 30, unit: "g" }, METRIC);
    expect(f.value).toBe(30);
    expect(f.unit).toBe("g");
    expect(f.display).toBe("30 g");
  });

  it("g → oz under imperial", () => {
    const f = formatMassSmall({ value: 28.3495, unit: "g" }, IMPERIAL);
    expect(f.value).toBeCloseTo(1, 3);
    expect(f.unit).toBe("oz");
  });
});

describe("formatGravity", () => {
  it("SG under sg prefs", () => {
    const f = formatGravity({ value: 1.052, unit: "sg" }, METRIC);
    expect(f.value).toBe(1.052);
    expect(f.unit).toBe("SG");
    expect(f.display).toBe("1.052");
  });

  it("SG → °P under plato prefs", () => {
    const f = formatGravity({ value: 1.052, unit: "sg" }, IMPERIAL);
    // 1.052 SG ≈ 12.86 °P (Plato polynomial)
    expect(f.value).toBeCloseTo(12.86, 1);
    expect(f.unit).toBe("°P");
  });

  it("accepts Plato input under SG prefs", () => {
    const f = formatGravity({ value: 12.86, unit: "plato" }, METRIC);
    // Round-trips back to ~1.052 SG via toSpecificGravity.
    expect(f.value).toBeCloseTo(1.052, 3);
  });
});

describe("formatColor", () => {
  it("EBC by default (the brewer-set fixture default)", () => {
    const f = formatColor({ value: 15, unit: "EBC" }, METRIC);
    expect(f.value).toBe(15);
    expect(f.unit).toBe("EBC");
  });

  it("EBC → SRM under SRM prefs", () => {
    const f = formatColor({ value: 19.7, unit: "EBC" }, IMPERIAL);
    expect(f.value).toBeCloseTo(10, 2);
    expect(f.unit).toBe("SRM");
  });

  it("SRM → EBC by default", () => {
    const f = formatColor({ value: 10, unit: "SRM" }, METRIC);
    expect(f.value).toBeCloseTo(19.7, 1);
  });
});

describe("raw-number formatters", () => {
  it("formatSrm follows the color preference", () => {
    expect(formatSrm(10, METRIC).unit).toBe("EBC");
    expect(formatSrm(10, IMPERIAL).unit).toBe("SRM");
  });

  it("formatSpecificGravity follows the gravity preference", () => {
    expect(formatSpecificGravity(1.05, METRIC).unit).toBe("SG");
    expect(formatSpecificGravity(1.05, IMPERIAL).unit).toBe("°P");
  });

  it("formatCelsius follows the temperature preference", () => {
    expect(formatCelsius(20, METRIC).unit).toBe("°C");
    expect(formatCelsius(20, IMPERIAL).unit).toBe("°F");
  });

  it("formatLiters follows the volume preference", () => {
    expect(formatLiters(20, METRIC).unit).toBe("L");
    expect(formatLiters(20, IMPERIAL).unit).toBe("gal");
  });
});

describe("reverse conversions (user input → canonical)", () => {
  // Round-trip is the property test brewers actually care about: typing
  // a value, having it stored canonically, and seeing it again should
  // not drift.
  it("temp round-trips: °F → °C → °F", () => {
    const c = userTempToCelsius(212, IMPERIAL);
    expect(c).toBeCloseTo(100, 4);
    expect(celsiusToUserTemp(c, IMPERIAL)).toBeCloseTo(212, 4);
  });

  it("temp passthrough under metric", () => {
    expect(userTempToCelsius(67, METRIC)).toBe(67);
    expect(celsiusToUserTemp(67, METRIC)).toBe(67);
  });

  it("volume round-trips: gal → L → gal", () => {
    const l = userVolumeToLiters(5, IMPERIAL);
    expect(l).toBeCloseTo(18.927, 2);
    expect(litersToUserVolume(l, IMPERIAL)).toBeCloseTo(5, 4);
  });

  it("mass-large round-trips: lb → kg → lb", () => {
    const kg = userMassLargeToKg(10, IMPERIAL);
    expect(kg).toBeCloseTo(4.536, 3);
    expect(kgToUserMassLarge(kg, IMPERIAL)).toBeCloseTo(10, 4);
  });

  it("mass-small round-trips: oz → g → oz", () => {
    const g = userMassSmallToG(1, IMPERIAL);
    expect(g).toBeCloseTo(28.3495, 3);
    expect(kgToUserMassSmall(g / 1000, IMPERIAL)).toBeCloseTo(1, 4);
  });

  it("color round-trips: EBC → SRM → EBC", () => {
    const srm = userColorToSrm(19.7, METRIC);
    expect(srm).toBeCloseTo(10, 2);
    expect(srmToUserColor(srm, METRIC)).toBeCloseTo(19.7, 2);
  });

  it("passthrough when pref matches canonical (kg / L / °C / SRM)", () => {
    expect(userMassLargeToKg(5, METRIC)).toBe(5);
    expect(userVolumeToLiters(20, METRIC)).toBe(20);
    expect(userMassSmallToG(30, METRIC)).toBe(30);
    expect(userColorToSrm(10, IMPERIAL)).toBe(10);
  });
});
