import type { WerbSession, SessionStep } from "@werb/types";
import type { BeerJsonRecipe, CultureAddition, CultureType } from "./beerjson.js";
import { toCelsius, toMinutes } from "./units.js";
import { computeStrikeTemp } from "@werb/calc";
import { recipeToStrikeTempInput, type StrikeTempOptions } from "./recipe-to-strike-temp.js";
import { DEFAULT_WHIRLPOOL_TEMP_C } from "./recipe-to-ibu.js";
import { DEFAULT_SPARGE_TEMP_C, isSpargeStep } from "./recipe-to-sparge.js";

/**
 * Derive a pitch temperature for the recipe's cultures.
 *
 * Preferred path: use each culture's BeerJSON `temperature_range.minimum`,
 * picking the max so every culture is at or above its documented minimum.
 * Fallback when no culture provides a range: use the culture `type` to look
 * up a sensible default minimum (ale 18, lager 10, kveik 30, etc.) and
 * apply the same max-of-mins rule.
 *
 * Returns 20 °C — generic ale pitch — when there are no cultures at all.
 */
const PITCH_DEFAULT_BY_TYPE: Record<CultureType, number> = {
  lager: 10,
  wine: 15,
  champagne: 15,
  ale: 18,
  wheat: 18,
  wild: 18,
  lacto: 18,
  pedio: 18,
  brett: 18,
  "mixed-culture": 18,
  bacteria: 18,
  malolactic: 18,
  other: 18,
  spontaneous: 18,
  kveik: 30,
};

export function pitchTempC(cultures: readonly CultureAddition[]): number {
  if (cultures.length === 0) return 20;
  const fromRanges = cultures
    .map((c) => c.temperature_range?.minimum)
    .filter((t): t is NonNullable<typeof t> => t !== undefined)
    .map((t) => toCelsius(t));
  if (fromRanges.length > 0) {
    return Math.max(...fromRanges);
  }
  const defaults = cultures.map((c) => PITCH_DEFAULT_BY_TYPE[c.type]);
  return Math.max(...defaults);
}

/**
 * Initialize a brew session from a recipe.
 *
 * Generates a flat step list for the brew day: mash rests from the recipe,
 * a sparge step, a boil with target duration, chill / transfer / pitch
 * steps. Every step starts in `pending` status; the brewer activates them
 * one at a time.
 *
 * A BeerJSON `sparge` mash step is not a rest: its temperature becomes the
 * sparge step's target, ahead of `deps.spargeTempC`.
 *
 * Boil hops are not separate steps: the brew screen lists them inside the
 * boil step. Whirlpool hops get a whirlpool step after the boil, held at
 * the hottest whirlpool temperature for the longest hold time.
 *
 * Pure function — no I/O. Caller provides `now()` and `id()` so tests can
 * use deterministic values.
 */
export interface SessionPlanDeps {
  now?: () => Date;
  id?: () => string;
  /** Strike-temp tuning passed through to the prepare-water step. */
  strikeTemp?: StrikeTempOptions;
  /**
   * BIAB rig: skip the sparge step entirely. The brewer lifts the
   * grain bag at the end of the mash and goes straight to boil.
   */
  biab?: boolean;
  /** Sparge water temperature (from computeSparge); 75 °C when absent. */
  spargeTempC?: number;
}

export function recipeToSessionPlan(
  recipe: BeerJsonRecipe,
  recipeId: string,
  deps: SessionPlanDeps = {},
): WerbSession {
  const now = deps.now ?? (() => new Date());
  const id =
    deps.id ??
    (() =>
      typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `id-${Math.random().toString(36).slice(2, 11)}`);

  const startedAt = now().toISOString();
  const steps: SessionStep[] = [];

  // Heat strike water to the temperature that will hit the recipe's mash
  // target once cool grain is added. Inserted before mash so the brewer
  // gets a dedicated timer/temperature target during the heat-up phase.
  // Step labels live on the brew session JSON, which is written once
  // and read back on every render. We deliberately leave `label`
  // empty for the canonical step kinds so the UI translates them
  // via `t("brew.kind.<kind>")` at display time — otherwise a French
  // brewer who started a session in English would see English labels
  // for the rest of the brew day. The only steps that *do* carry a
  // stored label are user-authored mash-step names (BeerJSON
  // `step.name` like "Sacc rest") and the pitch step, which appends
  // the culture names that the kind translation can't know about.
  const strikeInput = recipeToStrikeTempInput(recipe, deps.strikeTemp ?? {});
  const hasMashSteps = (recipe.mash?.mash_steps?.length ?? 0) > 0;
  if (strikeInput) {
    const out = computeStrikeTemp(strikeInput);
    steps.push({
      id: id(),
      kind: "prepare_water",
      label: "",
      status: "pending",
      target_temperature_c: out.strike_temp_c,
    });
  }

  if (hasMashSteps) {
    steps.push({
      id: id(),
      kind: "mash_in",
      label: "",
      status: "pending",
    });
  }

  for (const step of recipe.mash?.mash_steps ?? []) {
    if (isSpargeStep(step)) continue;
    steps.push({
      id: id(),
      kind: "mash",
      label: step.name ?? "",
      status: "pending",
      target_duration_min: toMinutes(step.step_time),
      target_temperature_c: toCelsius(step.step_temperature),
    });
  }

  // BIAB rigs skip the sparge: the brewer lifts the bag at the end of
  // the mash and goes straight to the boil.
  if (!deps.biab) {
    const recipeSparge = recipe.mash?.mash_steps?.find(isSpargeStep);
    steps.push({
      id: id(),
      kind: "sparge",
      label: "",
      status: "pending",
      target_temperature_c: recipeSparge
        ? toCelsius(recipeSparge.step_temperature)
        : (deps.spargeTempC ?? DEFAULT_SPARGE_TEMP_C),
    });
  }

  if (recipe.boil?.boil_time) {
    steps.push({
      id: id(),
      kind: "boil",
      label: "",
      status: "pending",
      target_duration_min: toMinutes(recipe.boil.boil_time),
    });
  }

  const whirlpoolHops = (recipe.ingredients.hop_additions ?? []).filter(
    (h) => h.timing?.use === "add_to_whirlpool",
  );
  if (whirlpoolHops.length > 0) {
    steps.push({
      id: id(),
      kind: "whirlpool",
      label: "",
      status: "pending",
      target_duration_min: Math.max(
        ...whirlpoolHops.map((h) => (h.timing.time ? toMinutes(h.timing.time) : 0)),
      ),
      target_temperature_c: Math.max(
        ...whirlpoolHops.map((h) =>
          h.timing.temperature ? toCelsius(h.timing.temperature) : DEFAULT_WHIRLPOOL_TEMP_C,
        ),
      ),
    });
  }

  // Chill to a pitch temp derived from the recipe's cultures: BeerJSON
  // temperature_range.minimum if any culture provides one, otherwise a
  // type-based default (ale, lager, kveik, etc.).
  steps.push({
    id: id(),
    kind: "chill",
    label: "",
    status: "pending",
    target_temperature_c: pitchTempC(recipe.ingredients.culture_additions ?? []),
  });

  steps.push({
    id: id(),
    kind: "transfer",
    label: "",
    status: "pending",
  });

  // Pitch step's label carries the culture names — the kind
  // translation alone ("Pitch") doesn't tell the brewer *which*
  // strain. We prepend "Pitch · " in render time via translation
  // and append the stored names; the names themselves stay verbatim
  // (proper-noun strain names cross every locale).
  const cultures = recipe.ingredients.culture_additions ?? [];
  if (cultures.length > 0) {
    const names = cultures.map((c) => c.name).join(" + ");
    steps.push({
      id: id(),
      kind: "ferment_pitch",
      label: names,
      status: "pending",
    });
  }

  return {
    id: id(),
    recipe_id: recipeId,
    recipe_name: recipe.name,
    status: "draft",
    started_at: startedAt,
    steps,
  };
}
