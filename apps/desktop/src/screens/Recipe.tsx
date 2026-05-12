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
  computeWaterAdditions,
} from "@werb/calc";
import type {
  WaterAdditionsInput,
  WaterAdditionsOutput,
  YeastPitchInput,
} from "@werb/types";
import { profileToWaterOverrides, type ProfileWithId } from "../data/equipment.ts";
import { exportBeerJson, exportBeerXml, exportRecipeHtml } from "../data/recipe-export.ts";
import { useBrewSessionExists } from "../hooks/useBrewSession.ts";
import { useRecipeTastings } from "../hooks/useBrewLog.ts";
import { computeRecipeCost, type CostLine } from "../data/cost.ts";
import { SensoryRadar } from "../components/SensoryRadar.tsx";
import { usePersistedJson } from "../storage/index.ts";
import { useUnits } from "../data/preferences.tsx";
import {
  formatColor,
  formatLiters,
  formatMassLarge,
  formatMassSmall,
  formatMoney,
  formatSpecificGravity,
  formatSrm,
  formatTemperature,
  formatVolume,
  type UnitPreferences,
} from "../data/units-format.ts";

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
  const prefs = useUnits();
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
  // Gravity values from BeerJSON are normalized through the formatter
  // so the user's pref (SG vs Plato) drives display. We keep the raw
  // SG numbers around too — they're what the calc engine + rangeHint
  // compare against.
  const claimedOgSg = recipe.original_gravity?.value ?? null;
  const claimedFgSg = recipe.final_gravity?.value ?? null;
  const claimedOgDisplay = claimedOgSg !== null
    ? formatSpecificGravity(claimedOgSg, prefs).display
    : "—";
  const claimedFgDisplay = claimedFgSg !== null
    ? formatSpecificGravity(claimedFgSg, prefs).display
    : "—";
  const claimedAbv = recipe.alcohol_by_volume?.value ?? null;
  const claimedSrm = recipe.color_estimate ? toSrm(recipe.color_estimate) : null;
  const claimedColorDisplay = recipe.color_estimate
    ? formatColor(recipe.color_estimate, prefs).display
    : null;
  const computedColorDisplay = formatSrm(computed.color.srm, prefs).display;
  const computedOgDisplay = formatSpecificGravity(computed.gravity.og, prefs).display;

  // BJCP range hints. `current` prefers the recipe's claimed value and falls
  // back to our computed estimate so the indicator works on bare imports.
  const styleHints = {
    og: rangeHint({
      current: claimedOgSg ?? computed.gravity.og,
      min: recipe.style?.original_gravity?.minimum?.value,
      max: recipe.style?.original_gravity?.maximum?.value,
      format: (v) => formatSpecificGravity(v, prefs).display,
    }),
    fg: rangeHint({
      current: claimedFgSg,
      min: recipe.style?.final_gravity?.minimum?.value,
      max: recipe.style?.final_gravity?.maximum?.value,
      format: (v) => formatSpecificGravity(v, prefs).display,
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
      format: (srm) => formatSrm(srm, prefs).display,
    }),
  };

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-4xl px-4 pt-12 pb-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-6 sm:mb-8 text-caption font-medium text-text-muted hover:text-text transition-colors flex items-center gap-2"
          >
            <span aria-hidden>←</span> Library
          </button>
        )}

        {/* ─── Header ───────────────────────────────────────────────────── */}
        <header className="mb-8 sm:mb-10 lg:mb-12">
          {recipe.style && (
            <p className="text-caption uppercase tracking-widest text-text-muted">
              {recipe.style.style_guide ? `${recipe.style.style_guide} · ` : ""}
              {recipe.style.category_number ?? ""}
              {recipe.style.style_letter ?? ""}
              {recipe.style.category ? ` · ${recipe.style.category}` : ""}
              {recipe.style.name ? ` · ${recipe.style.name}` : ""}
            </p>
          )}
          <h1 className="text-h2 sm:text-h1 font-semibold mt-3 capitalize break-words">{recipe.name.toLowerCase()}</h1>
          {recipe.author && recipe.author !== "Unknown" && (
            <p className="text-caption text-text-muted mt-1">by {recipe.author}</p>
          )}
          <p className="text-body text-text-muted mt-2 font-mono">
            {(() => {
              const v = formatVolume(recipe.batch_size, prefs);
              return `${v.value.toFixed(0)} ${v.unit}`;
            })()}
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
                prefs={prefs}
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
            <ExportMenu recipe={recipe} prefs={prefs} />
          </div>
        </header>

        {/* ─── Targets vs computed strip ───────────────────────────────── */}
        <section className="mb-8 sm:mb-10 lg:mb-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-px bg-border rounded-xl overflow-hidden">
          <Tile
            label="OG"
            value={claimedOgDisplay}
            sub={`≈${computedOgDisplay}`}
            warn={
              claimedOgSg !== null &&
              Math.abs(computed.gravity.og - claimedOgSg) > 0.008
            }
            styleHint={styleHints.og}
          />
          <Tile
            label="FG"
            value={claimedFgDisplay}
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

        {/* ─── Most recent tasting ─────────────────────────────────────── */}
        <TastingCard recipeId={recipeId} />

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
            <Tile label="Mash" value={formatLiters(computed.water.mash_water_l, prefs).display} />
            <Tile label="Sparge" value={formatLiters(computed.water.sparge_water_l, prefs).display} />
            <Tile label="Pre-boil" value={formatLiters(computed.water.pre_boil_volume_l, prefs).display} />
            <Tile label="Total water" value={formatLiters(computed.water.total_water_l, prefs).display} highlight />
          </div>
        </Section>

        {/* ─── Fermentables ────────────────────────────────────────────── */}
        <Section title="Fermentables">
          <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
            {recipe.ingredients.fermentable_additions.map((f, i) => {
              const massDisplay = isMass(f.amount)
                ? formatMassLarge(f.amount, prefs).display
                : "—";
              const colorDisplay = f.color
                ? formatColor(f.color, prefs).display
                : null;
              return (
                <li key={i} className="px-4 py-4 sm:px-6 sm:py-5 flex items-baseline justify-between gap-3 sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-body font-medium truncate">{f.name}</p>
                    <p className="text-body-sm text-text-muted mt-1">
                      <span className="capitalize">{f.type}</span>
                      {f.producer && ` · ${f.producer}`}
                      {colorDisplay && ` · ${colorDisplay}`}
                      {f.yield?.fine_grind && ` · yield ${f.yield.fine_grind.value}%`}
                    </p>
                  </div>
                  <div className="font-mono text-mono-lg shrink-0 text-right">
                    {massDisplay}
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
              const massDisplay = isMass(h.amount)
                ? formatMassSmall(h.amount, prefs).display
                : "—";
              const useLabel = TIMING_LABEL[h.timing?.use ?? ""] ?? "—";
              const time = h.timing?.time ? toMinutes(h.timing.time) : 0;
              const ibuValue = computed.ibuByIndex.get(i);
              return (
                <li key={i} className="px-4 py-4 sm:px-6 sm:py-5 flex items-baseline justify-between gap-3 sm:gap-6">
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
                    <div className="font-mono text-mono-lg">{massDisplay}</div>
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
                    ? formatMassSmall(m.amount, prefs).display
                    : isVolume(m.amount)
                    ? formatVolume(m.amount, prefs).display
                    : "—";
                  return (
                    <li key={i} className="px-4 py-4 sm:px-6 sm:py-5 flex items-baseline justify-between gap-3 sm:gap-6">
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
                <li key={i} className="px-4 py-4 sm:px-6 sm:py-5 flex items-baseline justify-between gap-3 sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-body font-medium">{step.name}</p>
                    <p className="text-body-sm text-text-muted mt-1 capitalize">
                      {step.type}
                      {step.amount && ` · ${formatVolume(step.amount, prefs).display} infusion`}
                      {step.infuse_temperature &&
                        ` @ ${formatTemperature(step.infuse_temperature, prefs).display}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-mono-lg text-accent">
                      {formatTemperature(step.step_temperature, prefs).display}
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
                  <li key={i} className="px-4 py-4 sm:px-6 sm:py-5 flex items-baseline justify-between gap-3 sm:gap-6">
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
                        ? formatMassSmall(c.amount, prefs).display
                        : isVolume(c.amount)
                        ? formatVolume(c.amount, prefs).display
                        : `${c.amount.value} ${c.amount.unit}`}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

        {/* ─── Yeast pitch ──────────────────────────────────────────────── */}
        <YeastPitchSection recipe={recipe} />

        {/* ─── Water chemistry ──────────────────────────────────────────── */}
        <WaterChemistrySection recipe={recipe} />

        {/* ─── Carbonation calculator ───────────────────────────────────── */}
        <CarbonationSection recipe={recipe} />

        {/* ─── Cost estimator ───────────────────────────────────────────── */}
        <CostSection recipe={recipe} />

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

function ExportMenu({ recipe, prefs }: { recipe: BeerJsonRecipe; prefs: UnitPreferences }) {
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
      fn: () => exportRecipeHtml(recipe, prefs),
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
          <div className="absolute right-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[20rem] max-w-[20rem] bg-surface-raised border border-border rounded-lg shadow-xl overflow-hidden">
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
      <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
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
          <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
            <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">
              Recommended
            </p>
            <p className="font-mono text-h3 sm:text-h2 mt-1 text-accent">
              {out.recommended_pack_count}{" "}
              <span className="text-body-sm text-text-muted">
                {yeastForm === "dry" ? "sachets" : "packs"}
              </span>
            </p>
            <p className="font-mono text-caption mt-1 text-text-muted">
              {out.packs_needed.toFixed(2)} packs exact
            </p>
          </div>
          <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
            <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">
              Status
            </p>
            <p
              className={`font-mono text-h3 sm:text-h2 mt-1 ${needStarter ? "text-warning" : "text-success"}`}
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

// ─── Water chemistry ───────────────────────────────────────────────────

const WATER_STORAGE_PREFIX = "werb.water.";
// Source water is the brewer's tap / RO / spring — same across recipes
// for most home brewers. Caching the latest entry as a preference auto-
// fills new recipes without forcing the user to retype.
const WATER_SOURCE_PREFS_KEY = "local.prefs.water";

interface IonProfile {
  ca_ppm: number;
  mg_ppm: number;
  na_ppm: number;
  cl_ppm: number;
  so4_ppm: number;
  hco3_ppm: number;
}

interface SaltAmounts {
  gypsum_g: number;
  calcium_chloride_g: number;
  epsom_g: number;
  table_salt_g: number;
  baking_soda_g: number;
}

interface WaterFormState {
  source: IonProfile;
  target_key: string;
  custom_target: IonProfile | null;
  salts: SaltAmounts;
  // Total water volume override. null → derive from recipe + active
  // profile losses (default).
  volume_l_override: number | null;
}

const ZERO_IONS: IonProfile = {
  ca_ppm: 0,
  mg_ppm: 0,
  na_ppm: 0,
  cl_ppm: 0,
  so4_ppm: 0,
  hco3_ppm: 0,
};

const ZERO_SALTS: SaltAmounts = {
  gypsum_g: 0,
  calcium_chloride_g: 0,
  epsom_g: 0,
  table_salt_g: 0,
  baking_soda_g: 0,
};

// Style-aligned ion targets (ppm). Round-numbered, drawn from Palmer /
// Bru'n Water common-target tables. "Off" disables target comparison
// — useful when the brewer just wants the resulting strip.
const TARGETS: Array<{ key: string; label: string; profile: IonProfile | null }> = [
  { key: "off", label: "No target", profile: null },
  {
    key: "balanced",
    label: "Balanced (general purpose)",
    profile: { ca_ppm: 80, mg_ppm: 10, na_ppm: 20, cl_ppm: 80, so4_ppm: 80, hco3_ppm: 80 },
  },
  {
    key: "pilsner",
    label: "Pilsner / light lager",
    profile: { ca_ppm: 50, mg_ppm: 5, na_ppm: 5, cl_ppm: 25, so4_ppm: 25, hco3_ppm: 0 },
  },
  {
    key: "pale_ale",
    label: "Pale ale",
    profile: { ca_ppm: 100, mg_ppm: 10, na_ppm: 15, cl_ppm: 60, so4_ppm: 150, hco3_ppm: 0 },
  },
  {
    key: "american_ipa",
    label: "American IPA (hop-forward)",
    profile: { ca_ppm: 110, mg_ppm: 10, na_ppm: 15, cl_ppm: 50, so4_ppm: 250, hco3_ppm: 0 },
  },
  {
    key: "burton",
    label: "Burton / English IPA",
    profile: { ca_ppm: 270, mg_ppm: 60, na_ppm: 35, cl_ppm: 65, so4_ppm: 600, hco3_ppm: 200 },
  },
  {
    key: "munich",
    label: "Munich / amber lager",
    profile: { ca_ppm: 80, mg_ppm: 20, na_ppm: 10, cl_ppm: 70, so4_ppm: 60, hco3_ppm: 150 },
  },
  {
    key: "dublin_stout",
    label: "Dublin stout",
    profile: { ca_ppm: 120, mg_ppm: 10, na_ppm: 15, cl_ppm: 70, so4_ppm: 60, hco3_ppm: 250 },
  },
];

const FLAVOR_HINT_LABELS: Record<WaterAdditionsOutput["flavor_hint"], string> = {
  very_malty: "Very malty",
  malty: "Malty leaning",
  balanced: "Balanced",
  hoppy: "Hop accent",
  very_hoppy: "Hop forward",
  none: "—",
};

function WaterChemistrySection({ recipe }: { recipe: BeerJsonRecipe }) {
  const batchL = toLiters(recipe.batch_size);

  // The total water that mixes with salts is mash + sparge — well
  // larger than the finished batch. Approximate as 1.4× batch when
  // we don't have a better number; the brewer can override.
  const defaultVolumeL = Math.round(batchL * 1.4 * 10) / 10;

  const [savedSource, setSavedSource] = usePersistedJson<IonProfile>(
    WATER_SOURCE_PREFS_KEY,
    ZERO_IONS,
  );
  const [form, setForm] = usePersistedJson<WaterFormState>(
    `${WATER_STORAGE_PREFIX}${recipe.name}`,
    {
      source: savedSource,
      target_key: "off",
      custom_target: null,
      salts: ZERO_SALTS,
      volume_l_override: null,
    },
  );

  const updateSource = (next: IonProfile) =>
    setForm((prev) => ({ ...prev, source: next }));

  const updateSalt = <K extends keyof SaltAmounts>(key: K, value: number) =>
    setForm((prev) => ({
      ...prev,
      salts: { ...prev.salts, [key]: Math.max(0, value) },
    }));

  const waterVolume = form.volume_l_override ?? defaultVolumeL;
  const target = TARGETS.find((t) => t.key === form.target_key)?.profile ?? null;

  const calcInput: WaterAdditionsInput = {
    water_volume_l: waterVolume,
    source: form.source,
    additions: {
      ...(form.salts.gypsum_g > 0 && { gypsum_g: form.salts.gypsum_g }),
      ...(form.salts.calcium_chloride_g > 0 && {
        calcium_chloride_g: form.salts.calcium_chloride_g,
      }),
      ...(form.salts.epsom_g > 0 && { epsom_g: form.salts.epsom_g }),
      ...(form.salts.table_salt_g > 0 && { table_salt_g: form.salts.table_salt_g }),
      ...(form.salts.baking_soda_g > 0 && { baking_soda_g: form.salts.baking_soda_g }),
    },
  };
  const result = computeWaterAdditions(calcInput);

  return (
    <Section
      title="Water chemistry"
      subtitle="Source water + brewing-salt additions. Pick a target profile to see deltas on the resulting ion strip."
    >
      <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
        <SourceWaterRow
          source={form.source}
          onChange={updateSource}
          onSaveDefault={() => setSavedSource(form.source)}
          savedMatches={ionsEqual(form.source, savedSource)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <CarbField
            label="Total water"
            unit="L"
            value={waterVolume}
            step={0.5}
            onChange={(v) =>
              setForm((prev) => ({
                ...prev,
                volume_l_override: Math.abs(v - defaultVolumeL) < 0.01 ? null : v,
              }))
            }
            hint={`Default ${defaultVolumeL.toFixed(1)} L (mash + sparge)`}
          />
          <label className="block sm:col-span-1 md:col-span-3">
            <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
              Target profile
            </span>
            <select
              value={form.target_key}
              onChange={(e) => setForm((p) => ({ ...p, target_key: e.target.value }))}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body text-text focus:outline-none focus:border-accent"
            >
              {TARGETS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <SaltsRow salts={form.salts} onChange={updateSalt} />

        <ResultStrip result={result} target={target} />

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-surface-raised border border-border px-4 py-3">
            <p className="text-caption uppercase tracking-widest text-text-muted">
              SO₄ : Cl
            </p>
            <p className="font-mono text-h3 mt-1">
              {result.so4_cl_ratio > 0 ? result.so4_cl_ratio.toFixed(2) : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-surface-raised border border-border px-4 py-3">
            <p className="text-caption uppercase tracking-widest text-text-muted">
              Flavor lean
            </p>
            <p className="font-mono text-h3 mt-1">
              {FLAVOR_HINT_LABELS[result.flavor_hint]}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function SourceWaterRow({
  source,
  onChange,
  onSaveDefault,
  savedMatches,
}: {
  source: IonProfile;
  onChange: (next: IonProfile) => void;
  onSaveDefault: () => void;
  savedMatches: boolean;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-caption uppercase tracking-widest text-text-muted">
          Source water (ppm)
        </p>
        <button
          type="button"
          onClick={onSaveDefault}
          disabled={savedMatches}
          className="text-caption text-text-muted hover:text-accent disabled:opacity-40 disabled:cursor-default transition-colors"
        >
          {savedMatches ? "✓ saved as default" : "Save as default"}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        <IonField label="Ca²⁺" value={source.ca_ppm} onChange={(v) => onChange({ ...source, ca_ppm: v })} />
        <IonField label="Mg²⁺" value={source.mg_ppm} onChange={(v) => onChange({ ...source, mg_ppm: v })} />
        <IonField label="Na⁺" value={source.na_ppm} onChange={(v) => onChange({ ...source, na_ppm: v })} />
        <IonField label="Cl⁻" value={source.cl_ppm} onChange={(v) => onChange({ ...source, cl_ppm: v })} />
        <IonField label="SO₄²⁻" value={source.so4_ppm} onChange={(v) => onChange({ ...source, so4_ppm: v })} />
        <IonField label="HCO₃⁻" value={source.hco3_ppm} onChange={(v) => onChange({ ...source, hco3_ppm: v })} />
      </div>
    </>
  );
}

function SaltsRow({
  salts,
  onChange,
}: {
  salts: SaltAmounts;
  onChange: <K extends keyof SaltAmounts>(key: K, value: number) => void;
}) {
  return (
    <div className="mt-6">
      <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
        Salt additions (g, total volume)
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <SaltField label="Gypsum" sub="CaSO₄" value={salts.gypsum_g} onChange={(v) => onChange("gypsum_g", v)} />
        <SaltField label="CaCl₂" sub="dihydrate" value={salts.calcium_chloride_g} onChange={(v) => onChange("calcium_chloride_g", v)} />
        <SaltField label="Epsom" sub="MgSO₄" value={salts.epsom_g} onChange={(v) => onChange("epsom_g", v)} />
        <SaltField label="Table salt" sub="NaCl" value={salts.table_salt_g} onChange={(v) => onChange("table_salt_g", v)} />
        <SaltField label="Baking soda" sub="NaHCO₃" value={salts.baking_soda_g} onChange={(v) => onChange("baking_soda_g", v)} />
      </div>
    </div>
  );
}

function ResultStrip({
  result,
  target,
}: {
  result: WaterAdditionsOutput;
  target: IonProfile | null;
}) {
  const ions: Array<{ label: string; value: number; targetVal: number | undefined }> = [
    { label: "Ca²⁺", value: result.ca_ppm, targetVal: target?.ca_ppm },
    { label: "Mg²⁺", value: result.mg_ppm, targetVal: target?.mg_ppm },
    { label: "Na⁺", value: result.na_ppm, targetVal: target?.na_ppm },
    { label: "Cl⁻", value: result.cl_ppm, targetVal: target?.cl_ppm },
    { label: "SO₄²⁻", value: result.so4_ppm, targetVal: target?.so4_ppm },
    { label: "HCO₃⁻", value: result.hco3_ppm, targetVal: target?.hco3_ppm },
  ];
  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-px bg-border rounded-xl overflow-hidden">
      {ions.map((ion) => {
        const delta = ion.targetVal !== undefined ? ion.value - ion.targetVal : null;
        // Tolerance is generous — water chemistry isn't a precision
        // game, and chasing the last few ppm encourages over-adjusting.
        const tolerance = ion.targetVal !== undefined ? Math.max(15, ion.targetVal * 0.2) : 0;
        const offTarget = delta !== null && Math.abs(delta) > tolerance;
        return (
          <div key={ion.label} className="bg-surface px-3 py-3 sm:px-4">
            <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">{ion.label}</p>
            <p className={`font-mono text-body sm:text-h3 mt-1 ${offTarget ? "text-warning" : "text-text"}`}>
              {ion.value.toFixed(0)}
            </p>
            {ion.targetVal !== undefined && (
              <p className={`font-mono text-caption mt-1 ${offTarget ? "text-warning" : "text-text-muted"}`}>
                target {ion.targetVal}
                {delta !== null && Math.abs(delta) >= 1 && (
                  <>
                    {" · "}
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(0)}
                  </>
                )}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IonField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-caption font-mono text-text-muted mb-1">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
        }}
        className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-body-sm font-mono tabular-nums text-text focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
    </label>
  );
}

function SaltField({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-caption uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className="block text-caption font-mono text-text-muted opacity-70 mb-1">
        {sub}
      </span>
      <div className="flex items-baseline gap-1 bg-bg border border-border rounded-lg px-2 py-1.5 focus-within:border-accent">
        <input
          type="number"
          min={0}
          step={0.5}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
          }}
          className="w-full bg-transparent text-body-sm font-mono tabular-nums text-text focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-caption font-mono text-text-muted shrink-0">g</span>
      </div>
    </label>
  );
}

function ionsEqual(a: IonProfile, b: IonProfile): boolean {
  return (
    a.ca_ppm === b.ca_ppm &&
    a.mg_ppm === b.mg_ppm &&
    a.na_ppm === b.na_ppm &&
    a.cl_ppm === b.cl_ppm &&
    a.so4_ppm === b.so4_ppm &&
    a.hco3_ppm === b.hco3_ppm
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
      <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
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
            <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
              <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">PSI</p>
              <p className="font-mono text-h3 sm:text-h2 mt-1 text-accent">
                {out.force_pressure_psi.toFixed(1)}
              </p>
              <p className="font-mono text-caption mt-1 text-text-muted">
                regulator at {form.serving_temp_c.toFixed(1)} °C
              </p>
            </div>
            <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
              <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">Bar</p>
              <p className="font-mono text-h3 sm:text-h2 mt-1">{out.force_pressure_bar.toFixed(2)}</p>
              <p className="font-mono text-caption mt-1 text-text-muted">same pressure, metric</p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Cost estimator ────────────────────────────────────────────────────────
//
// Approximate batch cost from the bundled default price table. Brewers
// adjust the global "Cost adjustment" coefficient in Settings to match
// their local market — single knob, no per-ingredient maintenance.

const CATEGORY_LABEL: Record<CostLine["category"], string> = {
  fermentable: "Grain",
  hop: "Hop",
  culture: "Yeast",
  misc: "Misc",
};

function CostSection({ recipe }: { recipe: BeerJsonRecipe }) {
  const prefs = useUnits();
  const breakdown = useMemo(
    () => computeRecipeCost(recipe, prefs.cost_inflation_pct),
    [recipe, prefs.cost_inflation_pct],
  );

  if (breakdown.total_count === 0) return null;

  const inflationNote =
    prefs.cost_inflation_pct === 100
      ? "Approximate. Adjust the global price coefficient in Settings to match your market."
      : `Approximate · ${prefs.cost_inflation_pct}% of bundled prices (Settings → Cost adjustment).`;

  return (
    <Section title="Cost" subtitle={inflationNote}>
      <div className="rounded-xl bg-surface border border-border">
        <ul className="divide-y divide-border">
          {breakdown.lines.map((line, i) => (
            <CostLineRow
              key={`${line.category}-${line.name}-${i}`}
              line={line}
              prefs={prefs}
            />
          ))}
        </ul>

        <div className="px-4 py-4 sm:px-6 sm:py-5 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-px bg-border">
          <CostStat
            label="Batch total"
            value={formatMoney(breakdown.total, prefs)}
            tone="highlight"
          />
          <CostStat
            label={`Per ${formatLiters(1, prefs).unit}`}
            value={formatMoney(breakdown.per_liter, prefs)}
          />
          <CostStat
            label="Per 330 mL bottle"
            value={formatMoney(breakdown.per_bottle_330, prefs)}
          />
        </div>
      </div>
    </Section>
  );
}

/**
 * Render the (summed) quantity of a cost line in the user's preferred
 * units. Returns null when the line couldn't be priced (no convertible
 * amount) so the UI can omit it cleanly.
 */
function formatCostAmount(line: CostLine, prefs: UnitPreferences): string | null {
  if (line.amount_in_natural_unit === null || line.natural_unit === null) {
    return null;
  }
  const v = line.amount_in_natural_unit;
  switch (line.natural_unit) {
    case "g":
      return formatMassSmall({ value: v, unit: "g" }, prefs).display;
    case "kg":
      return formatMassLarge({ value: v, unit: "kg" }, prefs).display;
    case "L":
      return formatVolume({ value: v, unit: "l" }, prefs).display;
    case "pack": {
      const rounded = Math.round(v * 100) / 100;
      return `${rounded} pack${rounded === 1 ? "" : "s"}`;
    }
  }
}

function CostLineRow({
  line,
  prefs,
}: {
  line: CostLine;
  prefs: UnitPreferences;
}) {
  const amountDisplay = formatCostAmount(line, prefs);
  return (
    <li className="px-4 py-3 sm:px-6 sm:py-4 flex items-baseline justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <p className="text-body-sm font-medium truncate">
          {line.name}
          {amountDisplay && (
            <span className="text-text-muted font-mono ml-2">
              {amountDisplay}
            </span>
          )}
        </p>
        <p className="text-caption text-text-muted mt-0.5">
          {CATEGORY_LABEL[line.category]}
          {line.default_unit_price !== null && line.natural_unit && (
            <>
              {" · "}
              {formatMoney(line.default_unit_price, prefs)}/{line.natural_unit}
            </>
          )}
        </p>
      </div>
      <p
        className={`font-mono text-body tabular-nums shrink-0 ${
          line.line_cost !== null ? "text-text" : "text-text-muted"
        }`}
      >
        {line.line_cost !== null ? formatMoney(line.line_cost, prefs) : "—"}
      </p>
    </li>
  );
}

function CostStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "highlight";
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-caption uppercase tracking-widest text-text-muted">
        {label}
      </p>
      <p
        className={`font-mono text-body sm:text-h3 mt-1 tabular-nums ${
          tone === "highlight" ? "text-accent" : "text-text"
        }`}
      >
        {value}
      </p>
    </div>
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
    <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
      <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">{label}</p>
      <p className="font-mono text-body sm:text-h3 mt-1 text-text">{display}</p>
      <p className="font-mono text-caption mt-1 text-text-muted">{note}</p>
    </div>
  );
}

function ScaleButton({
  onApply,
  recipe,
  profile,
  prefs,
}: {
  onApply: (scaled: BeerJsonRecipe) => void;
  recipe: BeerJsonRecipe;
  profile: ProfileWithId;
  prefs: UnitPreferences;
}) {
  // toLiters here is metric internal: profile.batch_size_l and the
  // dead-space / cap math are all in liters by contract. Display
  // strings go through the formatter so the user's pref is honored.
  const fromBatchL = toLiters(recipe.batch_size);
  const fromEff = recipe.efficiency?.brewhouse?.value ?? null;
  const sameBatch = Math.abs(fromBatchL - profile.batch_size_l) < 0.5;
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

    const fromBatchDisplay = formatLiters(fromBatchL, prefs).display;
    const targetBatchDisplay = formatLiters(profile.batch_size_l, prefs).display;
    const lines = [
      `Batch: ${fromBatchDisplay} → ${targetBatchDisplay}`,
      fromEff !== null ? `Efficiency: ${fromEff}% → ${profile.efficiency_pct}%` : null,
      fit.capped
        ? `Strike water capped: ${formatLiters(fit.capped.from_l, prefs).display} → ${formatLiters(fit.capped.to_l, prefs).display} (won't fit ${profile.mash_tun ? formatLiters(profile.mash_tun.capacity_l, prefs).display : ""} mash tun otherwise — sparge picks up the rest)`
        : null,
    ].filter(Boolean);

    if (confirm(`Adapt this recipe to "${profile.name}"?\n\n${lines.join("\n")}\n\nIngredient amounts will be rescaled in place.`)) {
      onApply(fit.recipe);
    }
  };

  const targetBatchDisplay = formatLiters(profile.batch_size_l, prefs).display;
  return (
    <button
      onClick={handleClick}
      disabled={isNoOp}
      title={
        isNoOp
          ? "Recipe already matches your rig — nothing to scale."
          : `Rescale to ${profile.name} (${targetBatchDisplay} · ${profile.efficiency_pct}% efficiency). Caps strike water to your mash tun if needed.`
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
    <section className="mb-8 sm:mb-10 lg:mb-12">
      <h2 className="text-h3 font-semibold mb-1">{title}</h2>
      {subtitle && <p className="text-body-sm text-text-muted mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

/**
 * Surfaces the most recent tasting recorded for any session of this
 * recipe. The radar gives the brewer a visual feel for the last brew's
 * profile; the tags + notes hint at what to tweak before the next one.
 *
 * Stays hidden when no tasting exists yet — empty state would just be
 * noise on a recipe that hasn't been brewed-and-tasted.
 */
function TastingCard({ recipeId }: { recipeId: string }) {
  const { tastings, loading } = useRecipeTastings(recipeId);
  if (loading) return null;
  if (tastings.length === 0) return null;
  const latest = tastings[0]!;

  return (
    <Section
      title="Last tasting"
      subtitle={
        tastings.length > 1
          ? `Most recent of ${tastings.length} tastings across this recipe`
          : undefined
      }
    >
      <div className="rounded-xl bg-surface border border-border p-5 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="flex gap-1" aria-label={`${latest.tasting.overall_rating} of 5 stars`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    aria-hidden
                    className={`text-h3 leading-none ${
                      n <= latest.tasting.overall_rating ? "text-accent" : "text-text-muted"
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <p className="font-mono text-caption text-text-muted">
                {new Date(latest.tasting.tasted_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>

            {latest.tasting.tags && latest.tasting.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {latest.tasting.tags.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-pill bg-accent/15 text-accent text-caption font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {latest.tasting.notes && (
              <p className="mt-4 text-body-sm text-text whitespace-pre-wrap">
                {latest.tasting.notes}
              </p>
            )}
          </div>

          <div className="flex justify-center md:justify-end">
            <SensoryRadar axes={latest.tasting.axes} size={200} />
          </div>
        </div>
      </div>
    </Section>
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
    <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
      <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">{label}</p>
      <p
        className={`font-mono text-h3 sm:text-h2 mt-1 ${
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
