import { useMemo, useState } from "react";
import {
  recipeToIbuInput,
  recipeToWaterInput,
  recipeToColorInput,
  recipeToGravityInput,
  recipeToScaleInput,
  recipeToCarbonationInput,
  recipeToYeastPitchInput,
  applyScale,
  fitMashToTun,
  toGrams,
  toKilograms,
  toLiters,
  toMinutes,
  toCelsius,
  toSrm,
  isMass,
  isVolume,
  type BeerJsonRecipe,
} from "@werb/adapters";
import {
  computeIbu,
  computeWater,
  computeAbv,
  computeColor,
  computeGravity,
  computeScale,
  computeCarbonation,
  computeYeastPitch,
} from "@werb/calc";
import type { YeastPitchInput } from "@werb/types";
import { profileToWaterOverrides, type ProfileWithId } from "../data/equipment.ts";
import { exportBeerJson, exportBeerXml, exportRecipeHtml } from "../data/recipe-export.ts";
import { useBrewSessionExists } from "../hooks/useBrewSession.ts";
import { usePersistedJson } from "../storage/index.ts";

const TIMING_LABEL: Record<string, string> = {
  add_to_boil: "Boil",
  add_to_fermentation: "Dry hop",
  add_to_mash: "Mash",
  add_to_package: "Package",
};

interface RecipeScreenProps {
  recipeId: string;
  recipe: BeerJsonRecipe;
  activeProfile?: ProfileWithId | undefined;
  onBack?: (() => void) | undefined;
  onStartBrewing?: (() => void) | undefined;
  onEdit?: (() => void) | undefined;
  onApplyScaled?: ((scaled: BeerJsonRecipe) => void) | undefined;
}

export function RecipeScreen({ recipeId, recipe, activeProfile, onBack, onStartBrewing, onEdit, onApplyScaled }: RecipeScreenProps) {
  const hasActiveSession = useBrewSessionExists(recipeId);
  const computed = useMemo(() => {
    const ibu = computeIbu(recipeToIbuInput(recipe));
    const water = computeWater(recipeToWaterInput(recipe, profileToWaterOverrides(activeProfile)));
    const color = computeColor(recipeToColorInput(recipe));
    const gravity = computeGravity(recipeToGravityInput(recipe));
    const abv =
      recipe.original_gravity && recipe.final_gravity
        ? computeAbv(recipe.original_gravity.value, recipe.final_gravity.value)
        : null;
    // Per-addition IBU lookup keyed by index, since duplicate hop names exist.
    const boilHopIndices = (recipe.ingredients.hop_additions ?? [])
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h.timing?.use === "add_to_boil")
      .map(({ i }) => i);
    const ibuByIndex = new Map<number, number>();
    boilHopIndices.forEach((idx, k) => {
      ibuByIndex.set(idx, ibu.additions[k]?.ibu ?? 0);
    });
    return { ibu, water, color, gravity, abv, ibuByIndex };
  }, [recipe, activeProfile]);

  const claimedIbu = recipe.ibu_estimate?.ibu?.value ?? null;
  const claimedOg = recipe.original_gravity?.value ?? null;
  const claimedFg = recipe.final_gravity?.value ?? null;
  const claimedAbv = recipe.alcohol_by_volume?.value ?? null;
  const claimedSrm = recipe.color_estimate ? toSrm(recipe.color_estimate) : null;
  const claimedColorDisplay = recipe.color_estimate
    ? `${recipe.color_estimate.value.toFixed(0)} ${recipe.color_estimate.unit}`
    : null;
  const useEbc = recipe.color_estimate?.unit === "EBC";
  const computedColorDisplay = useEbc
    ? `${computed.color.ebc.toFixed(0)} EBC`
    : `${computed.color.srm.toFixed(1)} SRM`;

  // BJCP range hints. `current` prefers the recipe's claimed value and falls
  // back to our computed estimate so the indicator works on bare imports.
  const styleHints = {
    og: rangeHint({
      current: claimedOg ?? computed.gravity.og,
      min: recipe.style?.original_gravity?.minimum?.value,
      max: recipe.style?.original_gravity?.maximum?.value,
      format: (v) => v.toFixed(3),
    }),
    fg: rangeHint({
      current: claimedFg,
      min: recipe.style?.final_gravity?.minimum?.value,
      max: recipe.style?.final_gravity?.maximum?.value,
      format: (v) => v.toFixed(3),
    }),
    ibu: rangeHint({
      current: claimedIbu ?? computed.ibu.total_ibu,
      min: recipe.style?.international_bitterness_units?.minimum?.value,
      max: recipe.style?.international_bitterness_units?.maximum?.value,
      format: (v) => `${v.toFixed(0)} IBU`,
    }),
    abv: rangeHint({
      current: claimedAbv ?? computed.abv,
      min: recipe.style?.alcohol_by_volume?.minimum?.value,
      max: recipe.style?.alcohol_by_volume?.maximum?.value,
      format: (v) => `${v.toFixed(1)}%`,
    }),
    color: rangeHint({
      current: claimedSrm ?? computed.color.srm,
      min: recipe.style?.color?.minimum
        ? toSrm(recipe.style.color.minimum)
        : undefined,
      max: recipe.style?.color?.maximum
        ? toSrm(recipe.style.color.maximum)
        : undefined,
      format: (srm) => (useEbc ? `${(srm * 1.97).toFixed(0)} EBC` : `${srm.toFixed(1)} SRM`),
    }),
  };

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-4xl px-8 py-12">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-8 text-caption font-medium text-text-muted hover:text-text transition-colors flex items-center gap-2"
          >
            <span aria-hidden>←</span> Library
          </button>
        )}

        {/* ─── Header ───────────────────────────────────────────────────── */}
        <header className="mb-12">
          {recipe.style && (
            <p className="text-caption uppercase tracking-widest text-text-muted">
              {recipe.style.style_guide ? `${recipe.style.style_guide} · ` : ""}
              {recipe.style.category_number ?? ""}
              {recipe.style.style_letter ?? ""}
              {recipe.style.category ? ` · ${recipe.style.category}` : ""}
              {recipe.style.name ? ` · ${recipe.style.name}` : ""}
            </p>
          )}
          <h1 className="text-h1 font-semibold mt-3 capitalize">{recipe.name.toLowerCase()}</h1>
          {recipe.author && recipe.author !== "Unknown" && (
            <p className="text-caption text-text-muted mt-1">by {recipe.author}</p>
          )}
          <p className="text-body text-text-muted mt-2 font-mono">
            {toLiters(recipe.batch_size).toFixed(0)} L
            {recipe.boil?.boil_time && ` · ${toMinutes(recipe.boil.boil_time).toFixed(0)} min boil`}
            {recipe.efficiency?.brewhouse && ` · ${recipe.efficiency.brewhouse.value}% efficiency`}
            {recipe.type && ` · ${recipe.type}`}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 items-center">
            {onStartBrewing && (
              <button
                onClick={onStartBrewing}
                className="px-5 py-3 rounded-xl bg-accent text-bg text-body font-medium hover:opacity-90 transition-opacity"
              >
                {hasActiveSession ? "Resume brewing →" : "Start brewing →"}
              </button>
            )}
            {onApplyScaled && activeProfile && (
              <ScaleButton
                onApply={onApplyScaled}
                recipe={recipe}
                profile={activeProfile}
              />
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-3 rounded-xl bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent transition-colors"
              >
                Edit recipe
              </button>
            )}
            <ExportMenu recipe={recipe} />
          </div>
        </header>

        {/* ─── Targets vs computed strip ───────────────────────────────── */}
        <section className="mb-12 grid grid-cols-2 md:grid-cols-5 gap-px bg-border rounded-xl overflow-hidden">
          <Tile
            label="OG"
            value={claimedOg?.toFixed(3) ?? "—"}
            sub={`≈${computed.gravity.og.toFixed(3)}`}
            warn={
              claimedOg !== null && Math.abs(computed.gravity.og - claimedOg) > 0.008
            }
            styleHint={styleHints.og}
          />
          <Tile
            label="FG"
            value={claimedFg?.toFixed(3) ?? "—"}
            styleHint={styleHints.fg}
          />
          <Tile
            label="IBU"
            value={claimedIbu?.toString() ?? "—"}
            sub={`≈${computed.ibu.total_ibu.toFixed(0)}`}
            warn={claimedIbu !== null && Math.abs(computed.ibu.total_ibu - claimedIbu) > 15}
            styleHint={styleHints.ibu}
          />
          <Tile
            label="ABV"
            value={claimedAbv !== null ? `${claimedAbv.toFixed(1)}%` : "—"}
            sub={computed.abv !== null ? `≈${computed.abv.toFixed(1)}%` : undefined}
            warn={
              claimedAbv !== null &&
              computed.abv !== null &&
              Math.abs(computed.abv - claimedAbv) > 0.5
            }
            styleHint={styleHints.abv}
          />
          <Tile
            label="Color"
            value={claimedColorDisplay ?? "—"}
            sub={`≈${computedColorDisplay}`}
            warn={
              claimedSrm !== null && Math.abs(computed.color.srm - claimedSrm) > 3
            }
            styleHint={styleHints.color}
          />
        </section>

        {/* ─── Computed water strip ────────────────────────────────────── */}
        <Section
          title="Water volumes"
          subtitle={
            activeProfile
              ? `Computed using equipment profile "${activeProfile.name}"`
              : "Computed using generic defaults — set an equipment profile for accurate numbers"
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
            <Tile label="Mash" value={`${computed.water.mash_water_l.toFixed(1)} L`} />
            <Tile label="Sparge" value={`${computed.water.sparge_water_l.toFixed(1)} L`} />
            <Tile label="Pre-boil" value={`${computed.water.pre_boil_volume_l.toFixed(1)} L`} />
            <Tile label="Total water" value={`${computed.water.total_water_l.toFixed(1)} L`} highlight />
          </div>
        </Section>

        {/* ─── Fermentables ────────────────────────────────────────────── */}
        <Section title="Fermentables">
          <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
            {recipe.ingredients.fermentable_additions.map((f, i) => {
              const kg = isMass(f.amount) ? toKilograms(f.amount) : null;
              return (
                <li key={i} className="px-6 py-5 flex items-baseline justify-between gap-6">
                  <div className="min-w-0">
                    <p className="text-body font-medium truncate">{f.name}</p>
                    <p className="text-body-sm text-text-muted mt-1">
                      <span className="capitalize">{f.type}</span>
                      {f.producer && ` · ${f.producer}`}
                      {f.color && ` · ${f.color.value} ${f.color.unit}`}
                      {f.yield?.fine_grind && ` · yield ${f.yield.fine_grind.value}%`}
                    </p>
                  </div>
                  <div className="font-mono text-mono-lg shrink-0 text-right">
                    {kg !== null ? `${kg.toFixed(2)} kg` : "—"}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* ─── Hop additions ───────────────────────────────────────────── */}
        <Section
          title="Hop additions"
          subtitle="Boil hops contribute IBU. Dry hops are listed for reference."
        >
          <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
            {(recipe.ingredients.hop_additions ?? []).map((h, i) => {
              const g = isMass(h.amount) ? toGrams(h.amount) : null;
              const useLabel = TIMING_LABEL[h.timing?.use ?? ""] ?? "—";
              const time = h.timing?.time ? toMinutes(h.timing.time) : 0;
              const ibuValue = computed.ibuByIndex.get(i);
              return (
                <li key={i} className="px-6 py-5 flex items-baseline justify-between gap-6">
                  <div className="min-w-0">
                    <p className="text-body font-medium truncate">
                      {h.name}
                      {h.alpha_acid && (
                        <span className="text-text-muted font-mono text-body-sm ml-2">
                          {h.alpha_acid.value}% AA
                        </span>
                      )}
                    </p>
                    <p className="text-body-sm text-text-muted mt-1">
                      {useLabel}
                      {time > 0 && (
                        <>
                          {" · "}
                          {time >= 1440
                            ? `${(time / 1440).toFixed(0)} day`
                            : `${time.toFixed(0)} min`}
                        </>
                      )}
                      {h.form && ` · ${h.form}`}
                      {h.notes && ` · ${h.notes}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-mono-lg">
                      {g !== null ? `${g.toFixed(0)} g` : "—"}
                    </div>
                    {ibuValue !== undefined && ibuValue > 0 && (
                      <div className="font-mono text-caption text-data mt-1">
                        +{ibuValue.toFixed(1)} IBU
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* ─── Miscellaneous additions ─────────────────────────────────── */}
        {recipe.ingredients.miscellaneous_additions &&
          recipe.ingredients.miscellaneous_additions.length > 0 && (
            <Section title="Miscellaneous">
              <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
                {recipe.ingredients.miscellaneous_additions.map((m, i) => {
                  const useLabel = TIMING_LABEL[m.timing?.use ?? ""] ?? null;
                  const time = m.timing?.time ? toMinutes(m.timing.time) : 0;
                  const amount = isMass(m.amount)
                    ? `${toGrams(m.amount).toFixed(0)} g`
                    : isVolume(m.amount)
                    ? `${toLiters(m.amount).toFixed(2)} L`
                    : "—";
                  return (
                    <li key={i} className="px-6 py-5 flex items-baseline justify-between gap-6">
                      <div className="min-w-0">
                        <p className="text-body font-medium truncate">{m.name}</p>
                        <p className="text-body-sm text-text-muted mt-1">
                          {m.type && <span className="capitalize">{m.type}</span>}
                          {useLabel && ` · ${useLabel}`}
                          {time > 0 && ` · ${time.toFixed(0)} min`}
                          {m.notes && ` · ${m.notes}`}
                        </p>
                      </div>
                      <div className="font-mono text-mono-lg shrink-0">{amount}</div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

        {/* ─── Mash schedule ───────────────────────────────────────────── */}
        {recipe.mash && recipe.mash.mash_steps.length > 0 && (
          <Section
            title="Mash schedule"
            subtitle={recipe.mash.notes ?? undefined}
          >
            <ol className="rounded-xl bg-surface border border-border divide-y divide-border">
              {recipe.mash.mash_steps.map((step, i) => (
                <li key={i} className="px-6 py-5 flex items-baseline justify-between gap-6">
                  <div className="min-w-0">
                    <p className="text-body font-medium">{step.name}</p>
                    <p className="text-body-sm text-text-muted mt-1 capitalize">
                      {step.type}
                      {step.amount && ` · ${toLiters(step.amount).toFixed(1)} L infusion`}
                      {step.infuse_temperature &&
                        ` @ ${toCelsius(step.infuse_temperature).toFixed(1)}°C`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-mono-lg text-accent">
                      {toCelsius(step.step_temperature).toFixed(1)}°C
                    </div>
                    <div className="font-mono text-caption text-text-muted mt-1">
                      {toMinutes(step.step_time).toFixed(0)} min
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* ─── Cultures ────────────────────────────────────────────────── */}
        {recipe.ingredients.culture_additions &&
          recipe.ingredients.culture_additions.length > 0 && (
            <Section title="Cultures">
              <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
                {recipe.ingredients.culture_additions.map((c, i) => (
                  <li key={i} className="px-6 py-5 flex items-baseline justify-between gap-6">
                    <div className="min-w-0">
                      <p className="text-body font-medium">{c.name}</p>
                      <p className="text-body-sm text-text-muted mt-1">
                        <span className="capitalize">
                          {c.form} · {c.type}
                        </span>
                        {c.producer && ` · ${c.producer}`}
                        {c.product_id && ` · ${c.product_id}`}
                        {c.attenuation && ` · ${c.attenuation.value}% atten`}
                      </p>
                    </div>
                    <div className="font-mono text-mono-lg shrink-0">
                      {!c.amount
                        ? "—"
                        : isMass(c.amount)
                        ? `${toGrams(c.amount).toFixed(0)} g`
                        : isVolume(c.amount)
                        ? `${toLiters(c.amount).toFixed(2)} L`
                        : `${c.amount.value} ${c.amount.unit}`}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

        {/* ─── Yeast pitch ──────────────────────────────────────────────── */}
        <YeastPitchSection recipe={recipe} />

        {/* ─── Carbonation calculator ───────────────────────────────────── */}
        <CarbonationSection recipe={recipe} />

        {/* ─── Footer note about IBU discrepancy ──────────────────────── */}
        {claimedIbu !== null && Math.abs(computed.ibu.total_ibu - claimedIbu) > 15 && (
          <aside className="mt-12 rounded-xl border border-border bg-surface p-6">
            <p className="text-caption uppercase tracking-widest text-warning font-medium">
              IBU discrepancy
            </p>
            <p className="text-body text-text-muted mt-2 leading-relaxed">
              Recipe target is{" "}
              <span className="text-text font-mono">{claimedIbu} IBU</span>; computed (Tinseth on
              boil hops, no whirlpool reduction) is{" "}
              <span className="text-text font-mono">
                {computed.ibu.total_ibu.toFixed(0)} IBU
              </span>
              . The original software likely treated the late "Aroma" addition as a whirlpool
              stand (no IBU contribution under standard Tinseth). Werb preserves the recorded
              boil time as recorded — reconcile by editing the addition's timing or by adding
              a whirlpool calc later.
            </p>
          </aside>
        )}
      </main>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────

function ExportMenu({ recipe }: { recipe: BeerJsonRecipe }) {
  const [open, setOpen] = useState(false);

  const run = async (fn: () => Promise<{ error?: string | undefined }>) => {
    setOpen(false);
    const r = await fn();
    if (r.error) alert(r.error);
  };

  const options: {
    label: string;
    sublabel: string;
    fn: () => Promise<{ error?: string | undefined }>;
  }[] = [
    {
      label: "BeerJSON (.beerjson)",
      sublabel: "Modern JSON format — round-trips cleanly with most tools.",
      fn: () => exportBeerJson(recipe),
    },
    {
      label: "BeerXML (.xml)",
      sublabel: "Legacy XML — works with BeerSmith and older imports.",
      fn: () => exportBeerXml(recipe),
    },
    {
      label: "Printable HTML / PDF",
      sublabel: "Self-contained .html — open in any browser, print to PDF.",
      fn: () => exportRecipeHtml(recipe),
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-4 py-3 rounded-xl bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent transition-colors flex items-center gap-2"
      >
        Export
        <span aria-hidden className="text-caption">▾</span>
      </button>
      {open && (
        <>
          {/* Click-outside backdrop. */}
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            aria-hidden
          />
          <div className="absolute right-0 top-full mt-2 z-50 min-w-[20rem] bg-surface-raised border border-border rounded-lg shadow-xl overflow-hidden">
            {options.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => run(opt.fn)}
                className="block w-full text-left px-4 py-3 hover:bg-surface focus:bg-surface border-b border-border last:border-b-0 transition-colors"
              >
                <p className="text-body-sm font-medium text-text">{opt.label}</p>
                <p className="text-caption text-text-muted mt-0.5">{opt.sublabel}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


// ─── Yeast pitch ───────────────────────────────────────────────────────

const YEAST_PITCH_STORAGE_PREFIX = "werb.yeastpitch.";

interface YeastPitchFormState {
  yeast_pack_count: number;
  viability_pct: number;
}

function defaultViability(form: YeastPitchInput["yeast_form"]): number {
  return form === "dry" ? 97 : 80;
}

function YeastPitchSection({ recipe }: { recipe: BeerJsonRecipe }) {
  const input = recipeToYeastPitchInput(recipe);
  // Default form depends on the first culture; falls back to "liquid"
  // when the recipe has no cultures yet.
  const yeastForm = input?.yeast_form ?? "liquid";

  const [form, setForm] = usePersistedJson<YeastPitchFormState>(
    `${YEAST_PITCH_STORAGE_PREFIX}${recipe.name}`,
    {
      yeast_pack_count: 1,
      viability_pct: defaultViability(yeastForm),
    },
  );

  const update = <K extends keyof YeastPitchFormState>(
    key: K,
    value: YeastPitchFormState[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  // The recipe might not have an OG yet — show a placeholder rather
  // than zero numbers if so.
  if (!input) {
    return (
      <Section title="Yeast pitch">
        <p className="text-body-sm text-text-muted">
          Set an original gravity on the recipe to compute pitch rate.
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
  const formLabel = yeastForm === "dry" ? "dry yeast" : "liquid yeast";

  return (
    <Section
      title="Yeast pitch"
      subtitle={`Target cell count for ${formLabel}. Adjust pack count and viability to match what you have on hand.`}
    >
      <div className="rounded-xl bg-surface border border-border p-6">
        {/* Input row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <CarbField
            label="Packs on hand"
            unit={yeastForm === "dry" ? "sachets" : "packs"}
            value={form.yeast_pack_count}
            step={1}
            onChange={(v) => update("yeast_pack_count", Math.max(0, Math.round(v)))}
            hint={
              yeastForm === "dry"
                ? "~11.5 g sachets, ~115 B cells fresh"
                : "Wyeast / White Labs smack-pack, ~100 B at production"
            }
          />
          <CarbField
            label="Viability"
            unit="%"
            value={form.viability_pct}
            step={1}
            onChange={(v) => update("viability_pct", Math.min(100, Math.max(0, v)))}
            hint={
              yeastForm === "dry"
                ? "Dry yeast holds well — 97% fresh, drop to ~85% after a year"
                : "Liquid yeast drops ~21%/month from production"
            }
          />
        </div>

        {/* Derived stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <CarbStat
            label="Target"
            value={`${out.target_cells_billion.toFixed(0)} B`}
            sub={`${out.target_rate_m_per_ml_per_plato.toFixed(2)} M/mL/°P at ${out.og_plato.toFixed(1)} °P`}
          />
          <CarbStat
            label="Per pack (viable)"
            value={`${out.cells_per_pack_effective_billion.toFixed(0)} B`}
            sub={`Pack × viability`}
          />
        </div>

        {/* Verdict */}
        <div className="grid grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
          <div className="bg-surface px-5 py-4">
            <p className="text-caption uppercase tracking-widest text-text-muted">
              Recommended
            </p>
            <p className="font-mono text-h2 mt-1 text-accent">
              {out.recommended_pack_count}{" "}
              <span className="text-body-sm text-text-muted">
                {yeastForm === "dry" ? "sachets" : "packs"}
              </span>
            </p>
            <p className="font-mono text-caption mt-1 text-text-muted">
              {out.packs_needed.toFixed(2)} packs exact
            </p>
          </div>
          <div className="bg-surface px-5 py-4">
            <p className="text-caption uppercase tracking-widest text-text-muted">
              Status
            </p>
            <p
              className={`font-mono text-h2 mt-1 ${needStarter ? "text-warning" : "text-success"}`}
            >
              {needStarter ? "Under-pitch" : "Sufficient"}
            </p>
            <p className={`font-mono text-caption mt-1 ${needStarter ? "text-warning" : "text-text-muted"}`}>
              {needStarter
                ? `Short ${out.shortfall_billion_cells.toFixed(0)} B — buy more or make a starter`
                : `${form.yeast_pack_count} pack${form.yeast_pack_count === 1 ? "" : "s"} covers the target`}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Carbonation ───────────────────────────────────────────────────────

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

function CarbonationSection({ recipe }: { recipe: BeerJsonRecipe }) {
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

  return (
    <Section
      title="Carbonation"
      subtitle="Priming sugar amounts for bottle conditioning, plus the regulator pressure for force-carbonation in a keg."
    >
      <div className="rounded-xl bg-surface border border-border p-6">
        {/* Input row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CarbField
            label="Target"
            unit="vols"
            value={form.target_volumes_co2}
            step={0.1}
            onChange={(v) => update("target_volumes_co2", v)}
            hint="2.4 typical · 1.7 cask · 3.0 wheat"
          />
          <CarbField
            label="Package temp"
            unit="°C"
            value={form.package_temp_c}
            step={0.5}
            onChange={(v) => update("package_temp_c", v)}
            hint="Highest fermentation temp"
          />
          <CarbField
            label="Beer volume"
            unit="L"
            value={beerVolume}
            step={0.5}
            onChange={(v) =>
              update(
                "beer_volume_l_override",
                Math.abs(v - toLiters(recipe.batch_size)) < 0.01 ? null : v,
              )
            }
            hint={`Batch ${toLiters(recipe.batch_size).toFixed(1)} L`}
          />
          <CarbField
            label="Serving temp"
            unit="°C"
            value={form.serving_temp_c}
            step={0.5}
            onChange={(v) => update("serving_temp_c", v)}
            hint="For force-carb pressure"
          />
        </div>

        {/* Residual + needed strip */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <CarbStat
            label="Residual at package"
            value={`${out.residual_volumes_co2.toFixed(2)} vols`}
            sub={`Already dissolved at ${form.package_temp_c.toFixed(1)} °C`}
          />
          <CarbStat
            label="Needs to add"
            value={`${out.volumes_to_add.toFixed(2)} vols`}
            sub={
              overCarbed
                ? "Beer is already over the target — no priming"
                : `Target − residual = ${out.volumes_to_add.toFixed(2)} vols`
            }
            warn={overCarbed}
          />
        </div>

        {/* Priming sugar grid */}
        <div className="mb-6">
          <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
            Priming sugar (bottle / keg conditioning)
          </p>
          <div className="grid grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
            <CarbResult label="Corn sugar" value={out.priming.dextrose_g} note="dextrose" />
            <CarbResult label="Table sugar" value={out.priming.sucrose_g} note="sucrose" />
            <CarbResult label="DME" value={out.priming.dme_g} note="dry malt extract" />
          </div>
        </div>

        {/* Force carb */}
        <div>
          <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
            Force-carbonation pressure
          </p>
          <div className="grid grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
            <div className="bg-surface px-5 py-4">
              <p className="text-caption uppercase tracking-widest text-text-muted">PSI</p>
              <p className="font-mono text-h2 mt-1 text-accent">
                {out.force_pressure_psi.toFixed(1)}
              </p>
              <p className="font-mono text-caption mt-1 text-text-muted">
                regulator at {form.serving_temp_c.toFixed(1)} °C
              </p>
            </div>
            <div className="bg-surface px-5 py-4">
              <p className="text-caption uppercase tracking-widest text-text-muted">Bar</p>
              <p className="font-mono text-h2 mt-1">{out.force_pressure_bar.toFixed(2)}</p>
              <p className="font-mono text-caption mt-1 text-text-muted">same pressure, metric</p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function CarbField({
  label,
  unit,
  value,
  step,
  onChange,
  hint,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
        {label}
      </span>
      <div className="flex items-baseline gap-1 bg-bg border border-border rounded-lg px-3 py-2 focus-within:border-accent">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          className="w-full bg-transparent text-body font-mono tabular-nums text-text focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-caption font-mono text-text-muted shrink-0">{unit}</span>
      </div>
      {hint && <span className="block text-caption text-text-muted mt-1">{hint}</span>}
    </label>
  );
}

function CarbStat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="bg-surface-raised border border-border rounded-lg px-4 py-3">
      <p className="text-caption uppercase tracking-widest text-text-muted">{label}</p>
      <p className={`font-mono text-h3 mt-1 ${warn ? "text-warning" : "text-text"}`}>
        {value}
      </p>
      {sub && <p className="text-caption text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

function CarbResult({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  const display = value > 0 ? `${value.toFixed(0)} g` : "—";
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-caption uppercase tracking-widest text-text-muted">{label}</p>
      <p className="font-mono text-h3 mt-1 text-text">{display}</p>
      <p className="font-mono text-caption mt-1 text-text-muted">{note}</p>
    </div>
  );
}

function ScaleButton({
  onApply,
  recipe,
  profile,
}: {
  onApply: (scaled: BeerJsonRecipe) => void;
  recipe: BeerJsonRecipe;
  profile: ProfileWithId;
}) {
  const fromBatch = toLiters(recipe.batch_size);
  const fromEff = recipe.efficiency?.brewhouse?.value ?? null;
  const sameBatch = Math.abs(fromBatch - profile.batch_size_l) < 0.5;
  const sameEff = fromEff !== null && Math.abs(fromEff - profile.efficiency_pct) < 1;
  const isNoOp = sameBatch && sameEff;

  const handleClick = () => {
    if (isNoOp) return;
    // Preview the full pipeline: scale → fit-to-tun.
    const out = computeScale(recipeToScaleInput(recipe, profile));
    const scaled = applyScale(recipe, out);
    const fit = profile.mash_tun
      ? fitMashToTun(scaled, profile.mash_tun)
      : { recipe: scaled, capped: null };

    const lines = [
      `Batch: ${fromBatch.toFixed(0)} L → ${profile.batch_size_l} L`,
      fromEff !== null ? `Efficiency: ${fromEff}% → ${profile.efficiency_pct}%` : null,
      fit.capped
        ? `Strike water capped: ${fit.capped.from_l.toFixed(1)} L → ${fit.capped.to_l.toFixed(1)} L (won't fit ${profile.mash_tun?.capacity_l} L mash tun otherwise — sparge picks up the rest)`
        : null,
    ].filter(Boolean);

    if (confirm(`Adapt this recipe to "${profile.name}"?\n\n${lines.join("\n")}\n\nIngredient amounts will be rescaled in place.`)) {
      onApply(fit.recipe);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isNoOp}
      title={
        isNoOp
          ? "Recipe already matches your rig — nothing to scale."
          : `Rescale to ${profile.name} (${profile.batch_size_l} L · ${profile.efficiency_pct}% efficiency). Caps strike water to your mash tun if needed.`
      }
      className="px-4 py-3 rounded-xl bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      Adapt to my rig
    </button>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="text-h3 font-semibold mb-1">{title}</h2>
      {subtitle && <p className="text-body-sm text-text-muted mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Tile({
  label,
  value,
  sub,
  highlight,
  warn,
  styleHint,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  highlight?: boolean | undefined;
  warn?: boolean | undefined;
  styleHint?: RangeHint | null | undefined;
}) {
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-caption uppercase tracking-widest text-text-muted">{label}</p>
      <p
        className={`font-mono text-h2 mt-1 ${
          highlight ? "text-accent" : warn ? "text-warning" : "text-text"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className={`font-mono text-caption mt-1 ${warn ? "text-warning" : "text-text-muted"}`}>
          {sub}
        </p>
      )}
      {styleHint && (
        <p
          className={`font-mono text-caption mt-1 ${
            styleHint.status === "in" ? "text-success" : "text-warning"
          }`}
          title={styleHint.tooltip}
        >
          {styleHint.label}
        </p>
      )}
    </div>
  );
}

interface RangeHint {
  status: "in" | "low" | "high";
  label: string;
  tooltip: string;
}

function rangeHint({
  current,
  min,
  max,
  format,
}: {
  current: number | null | undefined;
  min: number | undefined;
  max: number | undefined;
  format: (v: number) => string;
}): RangeHint | null {
  if (current === null || current === undefined) return null;
  if (min === undefined && max === undefined) return null;
  const rangeStr =
    min !== undefined && max !== undefined
      ? `${format(min)}–${format(max)}`
      : min !== undefined
      ? `≥ ${format(min)}`
      : `≤ ${format(max!)}`;
  if (min !== undefined && current < min) {
    return { status: "low", label: `↓ under style`, tooltip: `BJCP range: ${rangeStr}` };
  }
  if (max !== undefined && current > max) {
    return { status: "high", label: `↑ over style`, tooltip: `BJCP range: ${rangeStr}` };
  }
  return { status: "in", label: `✓ in style`, tooltip: `BJCP range: ${rangeStr}` };
}
