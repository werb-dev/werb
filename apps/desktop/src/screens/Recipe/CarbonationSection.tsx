import { useMemo } from "react";
import { recipeToCarbonationInput, toCelsius, toLiters } from "@werb/adapters";
import type { BeerJsonRecipe } from "@werb/adapters";
import { computeCarbonation } from "@werb/calc";
import { useT, useUnits } from "../../data/preferences.tsx";
import { usePersistedJson } from "../../storage/index.ts";
import { formatCelsius } from "../../data/units-format.ts";
import { Section } from "./Section.tsx";
import { CarbField, CarbStat, CarbResult } from "./CarbFields.tsx";

const CARBONATION_STORAGE_PREFIX = "werb.carbonation.";

interface CarbonationFormState {
  target_volumes_co2: number;
  package_temp_c: number;
  serving_temp_c: number;
  beer_volume_l_override: number | null;
}

function defaultPackageTemp(recipe: BeerJsonRecipe): number {
  // Use the active culture's max fermentation temp as a starting point —
  // that's the highest temp the beer reached, which sets residual CO2.
  const cultures = recipe.ingredients.culture_additions ?? [];
  for (const c of cultures) {
    const max = c.temperature_range?.maximum;
    if (max) return toCelsius(max);
  }
  return 20;
}

export function CarbonationSection({ recipe }: { recipe: BeerJsonRecipe }) {
  const tt = useT();
  const prefs = useUnits();
  const [form, setForm] = usePersistedJson<CarbonationFormState>(
    `${CARBONATION_STORAGE_PREFIX}${recipe.name}`,
    {
      target_volumes_co2: 2.4,
      package_temp_c: defaultPackageTemp(recipe),
      serving_temp_c: 4,
      beer_volume_l_override: null,
    },
  );

  const update = <K extends keyof CarbonationFormState>(
    key: K,
    value: CarbonationFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const out = useMemo(
    () =>
      computeCarbonation(
        recipeToCarbonationInput(recipe, {
          target_volumes_co2: form.target_volumes_co2,
          package_temp_c: form.package_temp_c,
          serving_temp_c: form.serving_temp_c,
          ...(form.beer_volume_l_override !== null && {
            beer_volume_l: form.beer_volume_l_override,
          }),
        }),
      ),
    [recipe, form],
  );

  const overCarbed = out.volumes_to_add < 0;
  const beerVolume = form.beer_volume_l_override ?? toLiters(recipe.batch_size);

  const servingTempDisplay = formatCelsius(form.serving_temp_c, prefs).display;
  return (
    <Section
      title={tt("recipe.section.carbonation")}
      subtitle={tt("recipe.carb.subtitle")}
    >
      <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
        {/* Input row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CarbField
            label={tt("recipe.carb.target")}
            unit="vols"
            value={form.target_volumes_co2}
            step={0.1}
            onChange={(v) => update("target_volumes_co2", v)}
            hint={tt("recipe.carb.target_hint")}
          />
          <CarbField
            label={tt("recipe.carb.package_temp")}
            unit="°C"
            value={form.package_temp_c}
            step={0.5}
            onChange={(v) => update("package_temp_c", v)}
            hint={tt("recipe.carb.package_temp_hint")}
          />
          <CarbField
            label={tt("recipe.carb.beer_volume")}
            unit="L"
            value={beerVolume}
            step={0.5}
            onChange={(v) =>
              update(
                "beer_volume_l_override",
                Math.abs(v - toLiters(recipe.batch_size)) < 0.01 ? null : v,
              )
            }
            hint={tt("recipe.carb.beer_volume_hint", { volume: toLiters(recipe.batch_size).toFixed(1) })}
          />
          <CarbField
            label={tt("recipe.carb.serving_temp")}
            unit="°C"
            value={form.serving_temp_c}
            step={0.5}
            onChange={(v) => update("serving_temp_c", v)}
            hint={tt("recipe.carb.serving_temp_hint")}
          />
        </div>

        {/* Residual + needed strip */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <CarbStat
            label={tt("recipe.carb.residual")}
            value={`${out.residual_volumes_co2.toFixed(2)} vols`}
            sub={tt("recipe.carb.residual_sub", {
              temp: formatCelsius(form.package_temp_c, prefs).display,
            })}
          />
          <CarbStat
            label={tt("recipe.carb.to_add")}
            value={`${out.volumes_to_add.toFixed(2)} vols`}
            sub={
              overCarbed
                ? tt("recipe.carb.over_warn")
                : tt("recipe.carb.to_add_sub", { delta: out.volumes_to_add.toFixed(2) })
            }
            warn={overCarbed}
          />
        </div>

        {/* Priming sugar grid */}
        <div className="mb-6">
          <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
            {tt("recipe.carb.priming")}
          </p>
          <div className="grid grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
            <CarbResult label={tt("recipe.carb.corn_sugar")} value={out.priming.dextrose_g} note={tt("recipe.carb.corn_sugar_note")} />
            <CarbResult label={tt("recipe.carb.sucrose")} value={out.priming.sucrose_g} note={tt("recipe.carb.sucrose_note")} />
            <CarbResult label={tt("recipe.carb.dme")} value={out.priming.dme_g} note={tt("recipe.carb.dme_note")} />
          </div>
        </div>

        {/* Force carb */}
        <div>
          <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
            {tt("recipe.carb.force")}
          </p>
          <div className="grid grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
            <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
              <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">{tt("recipe.carb.psi")}</p>
              <p className="font-mono text-h3 sm:text-h2 mt-1 text-accent">
                {out.force_pressure_psi.toFixed(1)}
              </p>
              <p className="font-mono text-caption mt-1 text-text-muted">
                {tt("recipe.carb.psi_sub", { temp: servingTempDisplay })}
              </p>
            </div>
            <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
              <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">{tt("recipe.carb.bar")}</p>
              <p className="font-mono text-h3 sm:text-h2 mt-1">{out.force_pressure_bar.toFixed(2)}</p>
              <p className="font-mono text-caption mt-1 text-text-muted">{tt("recipe.carb.bar_sub")}</p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
