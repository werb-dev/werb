import {
  toCelsius,
  toGrams,
  toKilograms,
  toLiters,
  toSpecificGravity,
  toSrm,
  type ColorType,
  type GravityType,
  type MassType,
  type TempType,
  type VolumeType,
} from "@werb/adapters";

/**
 * User unit preferences. Drives how raw BeerJSON values are presented
 * across the app — not what the values are stored as (BeerJSON keeps
 * its own units per field) and not what the calc engine works in
 * (always SI internally).
 *
 * Two principles:
 *   • Display-only. Editor and storage are unchanged; v1 just swaps
 *     how the existing data renders.
 *   • Pure functions. The format helpers take a value + a preferences
 *     bundle and return a pre-formatted string; no React, no context.
 *     The context lives in preferences.tsx.
 */
export interface UnitPreferences {
  temperature: "C" | "F";
  /** "l" = liters, "gal" = US gallons. */
  volume: "l" | "gal";
  /** Large mass — fermentables, batch grain bills. */
  mass: "kg" | "lb";
  gravity: "sg" | "plato";
  color: "SRM" | "EBC";
}

export const DEFAULT_PREFS: UnitPreferences = {
  temperature: "C",
  volume: "l",
  mass: "kg",
  gravity: "sg",
  color: "EBC",
};

export interface Formatted {
  /** Numeric value in the target unit. */
  value: number;
  /** Display label for the unit, e.g. "°C", "L", "g", "SG". */
  unit: string;
  /** Pre-rendered "value unit" string at a sensible precision. */
  display: string;
}

// ─── Conversions ──────────────────────────────────────────────────────────

const L_PER_US_GAL = 3.78541;
const KG_PER_LB = 0.45359237;
const G_PER_OZ = 28.3495;
const EBC_PER_SRM = 1.97;

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

function sgToPlato(sg: number): number {
  return -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;
}

// ─── Formatters ───────────────────────────────────────────────────────────

export function formatTemperature(t: TempType, p: UnitPreferences): Formatted {
  const c = toCelsius(t);
  if (p.temperature === "F") {
    const f = cToF(c);
    return { value: f, unit: "°F", display: `${f.toFixed(1)} °F` };
  }
  return { value: c, unit: "°C", display: `${c.toFixed(1)} °C` };
}

export function formatVolume(v: VolumeType, p: UnitPreferences): Formatted {
  const l = toLiters(v);
  if (p.volume === "gal") {
    const gal = l / L_PER_US_GAL;
    return { value: gal, unit: "gal", display: `${gal.toFixed(2)} gal` };
  }
  return { value: l, unit: "L", display: `${l.toFixed(1)} L` };
}

/** Format a mass at the "kg / lb" scale — fermentables, grain bills. */
export function formatMassLarge(m: MassType, p: UnitPreferences): Formatted {
  const kg = toKilograms(m);
  if (p.mass === "lb") {
    const lb = kg / KG_PER_LB;
    return { value: lb, unit: "lb", display: `${lb.toFixed(2)} lb` };
  }
  return { value: kg, unit: "kg", display: `${kg.toFixed(2)} kg` };
}

/** Format a mass at the "g / oz" scale — hops, miscs, yeast. */
export function formatMassSmall(m: MassType, p: UnitPreferences): Formatted {
  const g = toGrams(m);
  if (p.mass === "lb") {
    const oz = g / G_PER_OZ;
    return { value: oz, unit: "oz", display: `${oz.toFixed(2)} oz` };
  }
  return { value: g, unit: "g", display: `${g.toFixed(0)} g` };
}

export function formatGravity(g: GravityType, p: UnitPreferences): Formatted {
  const sg = toSpecificGravity(g);
  if (p.gravity === "plato") {
    const plato = sgToPlato(sg);
    return { value: plato, unit: "°P", display: `${plato.toFixed(1)} °P` };
  }
  return { value: sg, unit: "SG", display: sg.toFixed(3) };
}

export function formatColor(c: ColorType, p: UnitPreferences): Formatted {
  const srm = toSrm(c);
  if (p.color === "EBC") {
    const ebc = srm * EBC_PER_SRM;
    return { value: ebc, unit: "EBC", display: `${ebc.toFixed(0)} EBC` };
  }
  return { value: srm, unit: "SRM", display: `${srm.toFixed(1)} SRM` };
}

/**
 * Format a raw number already in SRM (e.g. the calc engine's output)
 * into the user's preferred color unit. Sibling of `formatColor` for
 * computed values that aren't BeerJSON ColorTypes.
 */
export function formatSrm(srm: number, p: UnitPreferences): Formatted {
  if (p.color === "EBC") {
    const ebc = srm * EBC_PER_SRM;
    return { value: ebc, unit: "EBC", display: `${ebc.toFixed(0)} EBC` };
  }
  return { value: srm, unit: "SRM", display: `${srm.toFixed(1)} SRM` };
}

/** Same idea for a raw SG number (out of the gravity calc). */
export function formatSpecificGravity(sg: number, p: UnitPreferences): Formatted {
  if (p.gravity === "plato") {
    const plato = sgToPlato(sg);
    return { value: plato, unit: "°P", display: `${plato.toFixed(1)} °P` };
  }
  return { value: sg, unit: "SG", display: sg.toFixed(3) };
}

/** Format a raw Celsius number into the user's preferred temperature unit. */
export function formatCelsius(c: number, p: UnitPreferences): Formatted {
  if (p.temperature === "F") {
    const f = cToF(c);
    return { value: f, unit: "°F", display: `${f.toFixed(1)} °F` };
  }
  return { value: c, unit: "°C", display: `${c.toFixed(1)} °C` };
}

/** Format a raw liters number into the user's preferred volume unit. */
export function formatLiters(l: number, p: UnitPreferences): Formatted {
  if (p.volume === "gal") {
    const gal = l / L_PER_US_GAL;
    return { value: gal, unit: "gal", display: `${gal.toFixed(2)} gal` };
  }
  return { value: l, unit: "L", display: `${l.toFixed(1)} L` };
}
