import type { BeerJsonRecipe } from "@werb/adapters";
import { recipeToGravityInput, recipeToYeastPitchInput, toLiters } from "@werb/adapters";
import { computeGravity, computeYeastPitch, computeYeastStarter, type StarterAeration } from "@werb/calc";
import type { YeastPitchInput } from "@werb/types";
import { useT } from "../../data/preferences.tsx";
import { usePersistedJson } from "../../storage/index.ts";
import { Section } from "./Section.tsx";
import { CarbField, CarbStat } from "./CarbFields.tsx";

const YEAST_PITCH_STORAGE_PREFIX = "werb.yeastpitch.";

interface YeastPitchFormState {
  yeast_pack_count: number;
  viability_pct: number;
  starter_aeration: StarterAeration;
}

function defaultViability(form: YeastPitchInput["yeast_form"]): number {
  return form === "dry" ? 97 : 80;
}

export function YeastPitchSection({ recipe }: { recipe: BeerJsonRecipe }) {
  const tt = useT();
  // Recipes built in-app don't carry a stored `original_gravity` — only
  // imports from BeerSmith/Brewfather typically do. Compute OG from the
  // grain bill as a fallback so the pitch calc works in both cases.
  const computedOg = computeGravity(recipeToGravityInput(recipe)).og;
  const input = recipeToYeastPitchInput(recipe, {
    ...(computedOg > 1.001 && { og_sg: computedOg }),
  });
  // Default form depends on the first culture; falls back to "liquid"
  // when the recipe has no cultures yet.
  const yeastForm = input?.yeast_form ?? "liquid";

  const [form, setForm] = usePersistedJson<YeastPitchFormState>(
    `${YEAST_PITCH_STORAGE_PREFIX}${recipe.name}`,
    {
      yeast_pack_count: 1,
      viability_pct: defaultViability(yeastForm),
      starter_aeration: "stir_plate",
    },
  );

  const update = <K extends keyof YeastPitchFormState>(
    key: K,
    value: YeastPitchFormState[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  // No usable OG → name the real missing input. The previous message
  // told the brewer to "set an original gravity," but OG is derived
  // from the grain bill, so there's no field to set.
  if (!input) {
    const missing: string[] = [];
    if ((recipe.ingredients.fermentable_additions ?? []).length === 0) {
      missing.push(tt("recipe.yeast.missing.fermentables"));
    }
    if (toLiters(recipe.batch_size) <= 0) {
      missing.push(tt("recipe.yeast.missing.batch_size"));
    }
    return (
      <Section title={tt("recipe.section.yeast")} testId="yeast-pitch">
        <p className="text-body-sm text-text-muted">
          {missing.length > 0
            ? tt("recipe.yeast.cannot_compute_missing", { items: missing.join(", ") })
            : tt("recipe.yeast.cannot_compute")}
        </p>
      </Section>
    );
  }

  const out = computeYeastPitch({
    ...input,
    yeast_pack_count: form.yeast_pack_count,
    viability_pct: form.viability_pct,
  });
  const needStarter = !out.has_sufficient;
  const formLabel = tt(
    yeastForm === "dry" ? "recipe.yeast.form.dry" : "recipe.yeast.form.liquid",
  );
  const packUnit = tt(
    yeastForm === "dry" ? "recipe.yeast.pack_unit.dry" : "recipe.yeast.pack_unit.liquid",
  );

  return (
    <Section
      title={tt("recipe.section.yeast")}
      subtitle={tt("recipe.yeast.subtitle", { form: formLabel })}
      testId="yeast-pitch"
    >
      <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
        {/* Input row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <CarbField
            label={tt("recipe.yeast.packs")}
            unit={packUnit}
            value={form.yeast_pack_count}
            step={1}
            onChange={(v) => update("yeast_pack_count", Math.max(0, Math.round(v)))}
            hint={tt(
              yeastForm === "dry"
                ? "recipe.yeast.packs_hint.dry"
                : "recipe.yeast.packs_hint.liquid",
            )}
          />
          <CarbField
            label={tt("recipe.yeast.viability")}
            unit="%"
            value={form.viability_pct}
            step={1}
            onChange={(v) => update("viability_pct", Math.min(100, Math.max(0, v)))}
            hint={tt(
              yeastForm === "dry"
                ? "recipe.yeast.viability_hint.dry"
                : "recipe.yeast.viability_hint.liquid",
            )}
          />
        </div>

        {/* Derived stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <CarbStat
            label={tt("recipe.yeast.target")}
            value={`${out.target_cells_billion.toFixed(0)} ${tt("recipe.yeast.billion_unit")}`}
            sub={tt("recipe.yeast.target_sub", {
              rate: out.target_rate_m_per_ml_per_plato.toFixed(2),
              og: `${out.og_plato.toFixed(1)} °P`,
            })}
          />
          <CarbStat
            label={tt("recipe.yeast.per_pack")}
            value={`${out.cells_per_pack_effective_billion.toFixed(0)} ${tt("recipe.yeast.billion_unit")}`}
            sub={tt("recipe.yeast.per_pack_sub")}
          />
        </div>

        {/* Verdict */}
        <div className="grid grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
          <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
            <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">
              {tt("recipe.yeast.recommended")}
            </p>
            <p className="font-mono text-h3 sm:text-h2 mt-1 text-accent">
              {out.recommended_pack_count}{" "}
              <span className="text-body-sm text-text-muted">{packUnit}</span>
            </p>
            <p className="font-mono text-caption mt-1 text-text-muted">
              {tt("recipe.yeast.exact_packs", { packs: out.packs_needed.toFixed(2) })}
            </p>
          </div>
          <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
            <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">
              {tt("recipe.yeast.status")}
            </p>
            <p
              className={`font-mono text-h3 sm:text-h2 mt-1 ${needStarter ? "text-warning" : "text-success"}`}
            >
              {tt(needStarter ? "recipe.yeast.under_pitch" : "recipe.yeast.sufficient")}
            </p>
            <p className={`font-mono text-caption mt-1 ${needStarter ? "text-warning" : "text-text-muted"}`}>
              {needStarter
                ? tt("recipe.yeast.shortfall", { cells: out.shortfall_billion_cells.toFixed(0) })
                : tt("recipe.yeast.sufficient_body", { count: form.yeast_pack_count })}
            </p>
          </div>
        </div>

        {needStarter && (
          <StarterRecommendation
            availableCellsBillion={
              out.cells_per_pack_effective_billion * form.yeast_pack_count
            }
            targetCellsBillion={out.target_cells_billion}
            aeration={form.starter_aeration}
            onAerationChange={(v) => update("starter_aeration", v)}
          />
        )}
      </div>
    </Section>
  );
}

function StarterRecommendation({
  availableCellsBillion,
  targetCellsBillion,
  aeration,
  onAerationChange,
}: {
  availableCellsBillion: number;
  targetCellsBillion: number;
  aeration: StarterAeration;
  onAerationChange: (v: StarterAeration) => void;
}) {
  const tt = useT();
  const starter = computeYeastStarter({
    available_cells_billion: availableCellsBillion,
    target_cells_billion: targetCellsBillion,
    aeration,
  });
  return (
    <div className="mt-5 rounded-lg bg-bg border border-border p-4">
      <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
        {tt("recipe.yeast.starter_title")}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
        <div className="bg-surface px-3 py-3">
          <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">
            {tt("recipe.yeast.starter_volume")}
          </p>
          <p className="font-mono text-h3 mt-1 text-accent">
            {starter.starter_volume_l.toFixed(2)}{" "}
            <span className="text-body-sm text-text-muted">L</span>
          </p>
        </div>
        <div className="bg-surface px-3 py-3">
          <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">
            {tt("recipe.yeast.starter_dme")}
          </p>
          <p className="font-mono text-h3 mt-1">
            {starter.dme_g}
            <span className="text-body-sm text-text-muted"> g</span>
          </p>
          <p className="font-mono text-caption mt-1 text-text-muted">
            {tt("recipe.yeast.starter_dme_sub")}
          </p>
        </div>
        <div className="bg-surface px-3 py-3">
          <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">
            {tt("recipe.yeast.starter_predicted")}
          </p>
          <p
            className={`font-mono text-h3 mt-1 ${
              starter.needs_step_up ? "text-warning" : "text-success"
            }`}
          >
            {starter.predicted_cells_billion.toFixed(0)}{" "}
            <span className="text-body-sm text-text-muted">{tt("recipe.yeast.billion_unit")}</span>
          </p>
          <p className="font-mono text-caption mt-1 text-text-muted">
            {tt("recipe.yeast.starter_growth", {
              factor: starter.growth_factor.toFixed(1),
            })}
          </p>
        </div>
        <label className="bg-surface px-3 py-3 block">
          <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">
            {tt("recipe.yeast.starter_aeration")}
          </p>
          <select
            value={aeration}
            onChange={(e) => onAerationChange(e.target.value as StarterAeration)}
            className="mt-1 w-full bg-bg border border-border rounded-md px-2 py-1 text-body-sm text-text focus:outline-none focus:border-accent"
          >
            <option value="stir_plate">
              {tt("recipe.yeast.starter_aeration_stir")}
            </option>
            <option value="shake">{tt("recipe.yeast.starter_aeration_shake")}</option>
            <option value="none">{tt("recipe.yeast.starter_aeration_none")}</option>
          </select>
        </label>
      </div>
      {starter.needs_step_up && (
        <p className="font-mono text-caption text-warning mt-3">
          {tt("recipe.yeast.starter_step_up")}
        </p>
      )}
    </div>
  );
}
