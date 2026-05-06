/**
 * Minimal hand-typed BeerJSON 2.x shapes.
 *
 * This is intentionally a subset — only the fields the adapters and the
 * Recipe screen consume. The full BeerJSON tree has hundreds of optional
 * fields; we add them here as we use them.
 *
 * When we wire @werb/types/generated to BeerJSON's beer.json (a separate
 * step that needs json-schema-to-typescript with cross-file $ref support),
 * this file should be deleted.
 */

export interface BeerJsonFile {
  beerjson: {
    version: number;
    recipes?: BeerJsonRecipe[];
  };
}

export interface BeerJsonRecipe {
  name: string;
  type: "all grain" | "extract" | "partial mash" | "cider" | "kombucha" | "soda" | "mead" | "wine" | "other";
  author: string;
  batch_size: VolumeType;
  efficiency: { brewhouse?: PercentType };
  style?: BeerJsonStyle;
  ingredients: {
    fermentable_additions: FermentableAddition[];
    hop_additions?: HopAddition[];
    culture_additions?: CultureAddition[];
    miscellaneous_additions?: MiscAddition[];
    water_additions?: unknown[];
  };
  mash?: MashProcedure;
  boil?: { boil_time?: TimeType };
  original_gravity?: GravityType;
  final_gravity?: GravityType;
  alcohol_by_volume?: PercentType;
  ibu_estimate?: {
    method?: "Tinseth" | "Rager" | "Garetz" | "Other";
    ibu?: { value: number; unit: string };
  };
  color_estimate?: ColorType;
  notes?: string;
}

export interface BeerJsonStyle {
  name: string;
  category?: string;
  category_number?: number;
  style_letter?: string;
  style_guide?: string;
  type?: "beer" | "cider" | "kombucha" | "mead" | "other" | "soda" | "wine";
}

export interface FermentableAddition {
  name: string;
  type: "grain" | "sugar" | "extract" | "dry extract" | "fruit" | "juice" | "honey" | "other";
  yield?: { fine_grind?: PercentType; coarse_grind?: PercentType };
  color?: ColorType;
  amount: MassType | VolumeType;
  producer?: string;
  origin?: string;
  product_id?: string;
}

export interface HopAddition {
  name: string;
  alpha_acid?: PercentType;
  form?: "pellet" | "leaf" | "leaf (wet)" | "plug" | "extract" | "powder";
  amount: MassType | VolumeType;
  timing: TimingType;
  notes?: string;
  producer?: string;
}

export interface TimingType {
  use?: "add_to_mash" | "add_to_boil" | "add_to_fermentation" | "add_to_package";
  time?: TimeType;
  duration?: TimeType;
  step?: number;
}

export type CultureType =
  | "ale"
  | "lager"
  | "wheat"
  | "wild"
  | "kveik"
  | "lacto"
  | "pedio"
  | "brett"
  | "mixed-culture"
  | "champagne"
  | "wine"
  | "bacteria"
  | "malolactic"
  | "other"
  | "spontaneous";

export interface MiscAddition {
  name: string;
  type?: string;
  amount: MassType | VolumeType;
  timing?: TimingType;
  notes?: string;
}

export interface CultureAddition {
  name: string;
  type: CultureType;
  form: "liquid" | "dry" | "slant" | "culture" | "dregs";
  producer?: string;
  product_id?: string;
  /** Cultures can be measured by mass (dry yeast), volume (slurry), or unit count (packs). */
  amount?: MassType | VolumeType | UnitCountType;
  attenuation?: PercentType;
  /** Recommended fermentation temperature range (BeerJSON spec). */
  temperature_range?: {
    minimum?: TempType;
    maximum?: TempType;
  };
}

/** BeerJSON UnitType — for unitless counts like "1.2 packs", "1 each". */
export type UnitCountUnit = "1" | "unit" | "each" | "dimensionless" | "pkg";
export interface UnitCountType { value: number; unit: UnitCountUnit }

export interface MashProcedure {
  name: string;
  grain_temperature: TempType;
  notes?: string;
  mash_steps: MashStep[];
}

export interface MashStep {
  name: string;
  type: "infusion" | "temperature" | "decoction" | "souring mash" | "souring wort" | "drain mash tun" | "sparge";
  step_temperature: TempType;
  step_time: TimeType;
  ramp_time?: TimeType;
  end_temperature?: TempType;
  description?: string;
  amount?: VolumeType;
  infuse_temperature?: TempType;
}

// ─── Unit types ──────────────────────────────────────────────────────────

export type VolumeUnit = "ml" | "l" | "tsp" | "tbsp" | "floz" | "cup" | "pt" | "qt" | "gal" | "bbl" | "ifloz" | "ipt" | "iqt" | "igal" | "ibbl";
export type MassUnit = "mg" | "g" | "kg" | "lb" | "oz";
export type TimeUnit = "sec" | "min" | "hr" | "day" | "week" | "month" | "year";
export type TempUnit = "C" | "F";
export type ColorUnit = "EBC" | "Lovi" | "SRM";
export type GravityUnit = "sg" | "plato" | "brix";
export type PercentUnit = "%";

export interface VolumeType { value: number; unit: VolumeUnit }
export interface MassType { value: number; unit: MassUnit }
export interface TimeType { value: number; unit: TimeUnit }
export interface TempType { value: number; unit: TempUnit }
export interface ColorType { value: number; unit: ColorUnit }
export interface GravityType { value: number; unit: GravityUnit }
export interface PercentType { value: number; unit: PercentUnit }

export type AnyAmount = MassType | VolumeType | UnitCountType;

const MASS_UNITS = new Set(["mg", "g", "kg", "lb", "oz"]);
const VOLUME_UNITS = new Set([
  "ml", "l", "tsp", "tbsp", "floz", "cup", "pt", "qt", "gal", "bbl",
  "ifloz", "ipt", "iqt", "igal", "ibbl",
]);
const UNIT_UNITS = new Set(["1", "unit", "each", "dimensionless", "pkg"]);

export function isMass(x: AnyAmount): x is MassType {
  return MASS_UNITS.has(x.unit);
}

export function isVolume(x: AnyAmount): x is VolumeType {
  return VOLUME_UNITS.has(x.unit);
}

export function isUnitCount(x: AnyAmount): x is UnitCountType {
  return UNIT_UNITS.has(x.unit);
}
