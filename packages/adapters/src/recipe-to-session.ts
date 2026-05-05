import type { WerbSession, SessionStep } from "@werb/types";
import type { BeerJsonRecipe } from "./beerjson.js";
import { toCelsius, toMinutes } from "./units.js";

/**
 * Initialize a brew session from a recipe.
 *
 * Generates a flat step list for the brew day: mash steps from the recipe,
 * a sparge placeholder, a boil with target duration, chill / transfer /
 * pitch steps. Every step starts in `pending` status; the brewer activates
 * them one at a time.
 *
 * Hop additions are NOT separate steps in v0 — the brewer keeps the recipe
 * view alongside while the boil is running. v1 will add hop-countdown alerts
 * inside the boil step.
 *
 * Pure function — no I/O. Caller provides `now()` and `id()` so tests can
 * use deterministic values.
 */
export interface SessionPlanDeps {
  now?: () => Date;
  id?: () => string;
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

  // Mash steps
  for (const step of recipe.mash?.mash_steps ?? []) {
    steps.push({
      id: id(),
      kind: "mash",
      label: step.name || "Mash step",
      status: "pending",
      target_duration_min: toMinutes(step.step_time),
      target_temperature_c: toCelsius(step.step_temperature),
    });
  }

  // Sparge (implied; recipes rarely encode it as a discrete step)
  steps.push({
    id: id(),
    kind: "sparge",
    label: "Sparge",
    status: "pending",
  });

  // Boil
  if (recipe.boil?.boil_time) {
    steps.push({
      id: id(),
      kind: "boil",
      label: "Boil",
      status: "pending",
      target_duration_min: toMinutes(recipe.boil.boil_time),
    });
  }

  // Chill (custom)
  steps.push({
    id: id(),
    kind: "chill",
    label: "Chill to pitch temp",
    status: "pending",
  });

  // Transfer (custom)
  steps.push({
    id: id(),
    kind: "transfer",
    label: "Transfer to fermenter",
    status: "pending",
  });

  // Pitch yeast(s)
  const cultures = recipe.ingredients.culture_additions ?? [];
  if (cultures.length > 0) {
    const names = cultures.map((c) => c.name).join(" + ");
    steps.push({
      id: id(),
      kind: "ferment_pitch",
      label: `Pitch ${names}`,
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
