/**
 * Unit conversion helpers for BeerJSON quantities.
 * Pure, no I/O. Throws on unsupported units rather than silently approximating.
 */
import type { MassType, VolumeType, TimeType, TempType, GravityType, ColorType } from "./beerjson.js";

export function toGrams(m: MassType): number {
  switch (m.unit) {
    case "mg": return m.value / 1000;
    case "g": return m.value;
    case "kg": return m.value * 1000;
    case "oz": return m.value * 28.349523125;
    case "lb": return m.value * 453.59237;
    default: {
      const _exhaustive: never = m.unit;
      throw new Error(`unsupported mass unit: ${_exhaustive}`);
    }
  }
}

export function toKilograms(m: MassType): number {
  return toGrams(m) / 1000;
}

export function toLiters(v: VolumeType): number {
  switch (v.unit) {
    case "ml": return v.value / 1000;
    case "l": return v.value;
    case "tsp": return v.value * 0.00492892;
    case "tbsp": return v.value * 0.0147868;
    case "floz": return v.value * 0.0295735;
    case "cup": return v.value * 0.236588;
    case "pt": return v.value * 0.473176;
    case "qt": return v.value * 0.946353;
    case "gal": return v.value * 3.78541;
    case "bbl": return v.value * 117.348;
    case "ifloz": return v.value * 0.0284131;
    case "ipt": return v.value * 0.568261;
    case "iqt": return v.value * 1.13652;
    case "igal": return v.value * 4.54609;
    case "ibbl": return v.value * 163.659;
    default: {
      const _exhaustive: never = v.unit;
      throw new Error(`unsupported volume unit: ${_exhaustive}`);
    }
  }
}

export function toMinutes(t: TimeType): number {
  switch (t.unit) {
    case "sec": return t.value / 60;
    case "min": return t.value;
    case "hr": return t.value * 60;
    case "day": return t.value * 60 * 24;
    case "week": return t.value * 60 * 24 * 7;
    case "month": return t.value * 60 * 24 * 30;
    case "year": return t.value * 60 * 24 * 365;
    default: {
      const _exhaustive: never = t.unit;
      throw new Error(`unsupported time unit: ${_exhaustive}`);
    }
  }
}

export function toCelsius(t: TempType): number {
  if (t.unit === "C") return t.value;
  if (t.unit === "F") return ((t.value - 32) * 5) / 9;
  const _exhaustive: never = t.unit;
  throw new Error(`unsupported temperature unit: ${_exhaustive}`);
}

export function toSpecificGravity(g: GravityType): number {
  if (g.unit === "sg") return g.value;
  if (g.unit === "plato") return 1 + g.value / (258.6 - (g.value / 258.2) * 227.1);
  if (g.unit === "brix") return 1 + g.value / (258.6 - (g.value / 258.2) * 227.1);
  const _exhaustive: never = g.unit;
  throw new Error(`unsupported gravity unit: ${_exhaustive}`);
}

/**
 * Convert any color reading to SRM. Source-of-truth for our calc engine.
 *   Lovibond ≈ (SRM + 0.6) / 1.3546  (Daniels)
 *   EBC = SRM × 1.97
 */
export function toSrm(c: ColorType): number {
  if (c.unit === "SRM") return c.value;
  if (c.unit === "EBC") return c.value / 1.97;
  if (c.unit === "Lovi") return c.value * 1.3546 - 0.6;
  const _exhaustive: never = c.unit;
  throw new Error(`unsupported color unit: ${_exhaustive}`);
}
