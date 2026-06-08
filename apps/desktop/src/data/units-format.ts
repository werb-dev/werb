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
import { detectLocale, type Locale } from "./i18n.ts";

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
  currency: "EUR" | "USD" | "GBP";
  /**
   * Global multiplier applied to the bundled default ingredient prices.
   * 100 = ship as-is (EUR-anchored European homebrew supplier averages).
   * Brewers in pricier markets bump to 110-130; lower-cost markets dial
   * down. Single knob — per-category tuning is overkill for "approx
   * batch cost".
   */
  cost_inflation_pct: number;
  /**
   * Personal per-ingredient price overrides, keyed by "category:name"
   * (see `priceKey` in cost.ts). Value is the price per the ingredient's
   * natural unit (€/kg grain, €/g hop, €/pack yeast). Per-install — lives
   * under `local.prefs.*`, never synced — and overrides the bundled
   * baseline (and the inflation coefficient) for that ingredient.
   */
  ingredient_prices: Record<string, number>;
  /**
   * UI language. Seeded from the browser locale on first launch
   * (see `detectLocale`); changeable from Settings.
   */
  locale: Locale;
  /**
   * Visual theme. "auto" follows `prefers-color-scheme`; "dark" /
   * "light" force the choice regardless of OS preference. The dark
   * Cassis palette is the signature look; light is meant for
   * outdoor brewing on sunny days where dark mode washes out.
   */
  theme: "auto" | "dark" | "light";
  /**
   * IBU calculation method. Tinseth is the homebrew default and
   * what every modern calculator agrees on; Rager pre-dates it and
   * reads higher at long boils with a flat gravity correction.
   * Brewers comparing notes with older recipes / brewtarget often
   * want Rager.
   */
  ibu_method: "Tinseth" | "Rager";
  /**
   * Color estimation. Morey is the de facto homebrew formula;
   * Daniels uses a linear fit tuned for amber-to-dark beers and
   * tends to read lower than Morey above ~SRM 15.
   */
  color_method: "Morey" | "Daniels";
}

export const DEFAULT_PREFS: UnitPreferences = {
  temperature: "C",
  volume: "l",
  mass: "kg",
  gravity: "sg",
  color: "EBC",
  currency: "EUR",
  cost_inflation_pct: 100,
  ingredient_prices: {},
  locale: detectLocale(),
  theme: "auto",
  ibu_method: "Tinseth",
  color_method: "Morey",
};

const CURRENCY_SYMBOL: Record<UnitPreferences["currency"], string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

/** Render a money value in the user's preferred currency. */
export function formatMoney(value: number, p: UnitPreferences): string {
  const symbol = CURRENCY_SYMBOL[p.currency];
  // Two-decimal places matches the way prices are displayed in shops —
  // gives the brewer enough resolution for per-bottle costs (which can
  // land at €0.42 or similar). Hop-per-gram prices come in around €0.04,
  // also visible at 2 decimals.
  const formatted = value.toFixed(2);
  // Currency convention: USD prefixes the symbol ($1.50); EUR/GBP also
  // commonly prefix in homebrew supplier UIs. Keep prefix consistent
  // across the three to avoid mixed visual scanning.
  return `${symbol}${formatted}`;
}

export function currencySymbol(p: UnitPreferences): string {
  return CURRENCY_SYMBOL[p.currency];
}

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

// ─── Reverse conversions: user input → canonical SI ───────────────────────
//
// Used by the recipe editor so brewers can type amounts in their
// preferred units. The form stores everything canonically (kg, L, °C,
// SRM) so calc / adapters / export paths don't have to care about
// preferences.

/** User-typed value (°C or °F per prefs) → canonical Celsius. */
export function userTempToCelsius(value: number, p: UnitPreferences): number {
  if (p.temperature === "F") return ((value - 32) * 5) / 9;
  return value;
}

/** User-typed value (L or US gal per prefs) → canonical liters. */
export function userVolumeToLiters(value: number, p: UnitPreferences): number {
  if (p.volume === "gal") return value * L_PER_US_GAL;
  return value;
}

/** User-typed value (kg or lb per prefs) → canonical kilograms. */
export function userMassLargeToKg(value: number, p: UnitPreferences): number {
  if (p.mass === "lb") return value * KG_PER_LB;
  return value;
}

/** User-typed value (g or oz per prefs) → canonical grams. */
export function userMassSmallToG(value: number, p: UnitPreferences): number {
  if (p.mass === "lb") return value * G_PER_OZ;
  return value;
}

/** User-typed value (SRM or EBC per prefs) → canonical SRM. */
export function userColorToSrm(value: number, p: UnitPreferences): number {
  if (p.color === "EBC") return value / EBC_PER_SRM;
  return value;
}

/**
 * Display label for the unit the user types large masses in. Mirrors
 * what `formatMassLarge` would show, but for the input-side label that
 * follows the value.
 */
export function massLargeUnitLabel(p: UnitPreferences): string {
  return p.mass === "lb" ? "lb" : "kg";
}

export function massSmallUnitLabel(p: UnitPreferences): string {
  return p.mass === "lb" ? "oz" : "g";
}

export function volumeUnitLabel(p: UnitPreferences): string {
  return p.volume === "gal" ? "gal" : "L";
}

export function tempUnitLabel(p: UnitPreferences): string {
  return p.temperature === "F" ? "°F" : "°C";
}

export function colorUnitLabel(p: UnitPreferences): string {
  return p.color === "EBC" ? "EBC" : "SRM";
}

/** kg → display value in the user's preferred large-mass unit. */
export function kgToUserMassLarge(kg: number, p: UnitPreferences): number {
  return p.mass === "lb" ? kg / KG_PER_LB : kg;
}

/** kg → display value in the user's preferred small-mass unit (g or oz). */
export function kgToUserMassSmall(kg: number, p: UnitPreferences): number {
  const g = kg * 1000;
  return p.mass === "lb" ? g / G_PER_OZ : g;
}

/** Liters → display value in the user's preferred volume unit. */
export function litersToUserVolume(l: number, p: UnitPreferences): number {
  return p.volume === "gal" ? l / L_PER_US_GAL : l;
}

/** Celsius → display value in the user's preferred temperature unit. */
export function celsiusToUserTemp(c: number, p: UnitPreferences): number {
  return p.temperature === "F" ? cToF(c) : c;
}

/** SRM → display value in the user's preferred color unit. */
export function srmToUserColor(srm: number, p: UnitPreferences): number {
  return p.color === "EBC" ? srm * EBC_PER_SRM : srm;
}
