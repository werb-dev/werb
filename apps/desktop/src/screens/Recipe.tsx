import { useMemo, useState } from "react";
import {
  recipeToIbuInput,
  recipeToWaterInput,
  recipeToColorInput,
  recipeToGravityInput,
  recipeToScaleInput,
  recipeToCarbonationInput,
  applyScale,
  fitMashToTun,
  toLiters,
  toMinutes,
  toCelsius,
  toSrm,
  isMass,
  isVolume,
  recipeApparentAttenuationPct,
  type BeerJsonRecipe,
} from "@werb/adapters";
import {
  computeIbu,
  computeWater,
  computeAbv,
  computeColor,
  computeFg,
  computeGravity,
  computeScale,
  computeCarbonation,
} from "@werb/calc";
import { profileToWaterOverrides, type ProfileWithId } from "../data/equipment.ts";
import { exportBeerJson, exportBeerXml, exportRecipeHtml } from "../data/recipe-export.ts";
import { translateError, type WerbError } from "../data/errors.ts";
import { useBrewSessionExists } from "../hooks/useBrewSession.ts";
import { useRecipeTastings } from "../hooks/useBrewLog.ts";
import { computeRecipeCost, type CostLine } from "../data/cost.ts";
import { SensoryRadar } from "../components/SensoryRadar.tsx";
import { usePersistedJson } from "../storage/index.ts";
import { useT, useUnits } from "../data/preferences.tsx";
import {
  formatCelsius,
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
import { Section } from "./Recipe/Section.tsx";
import { Tile, rangeHint } from "./Recipe/Tile.tsx";
import { CarbField, CarbStat, CarbResult } from "./Recipe/CarbFields.tsx";
import { YeastPitchSection } from "./Recipe/YeastPitchSection.tsx";
import { WaterChemistrySection } from "./Recipe/WaterChemistrySection.tsx";

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
  const t = useT();
  const computed = useMemo(() => {
    const ibu = computeIbu({ ...recipeToIbuInput(recipe), method: prefs.ibu_method });
    const water = computeWater(recipeToWaterInput(recipe, profileToWaterOverrides(activeProfile)));
    const color = computeColor({ ...recipeToColorInput(recipe), method: prefs.color_method });
    const gravity = computeGravity(recipeToGravityInput(recipe));
    // FG is always computed (yeast attenuation × OG); the file value
    // takes precedence in the display but the estimate is the
    // workhorse for bare BeerXML imports that ship without a target
    // FG. ABV cascades: claimed file FG → computed FG, so we never
    // show "—" when a brewer has typed a grain bill + yeast.
    const apparentAttenuationPct = recipeApparentAttenuationPct(recipe);
    const fgEstimate = computeFg(gravity.og, apparentAttenuationPct);
    const ogForAbv = recipe.original_gravity?.value ?? gravity.og;
    const fgForAbv = recipe.final_gravity?.value ?? fgEstimate;
    const abv = computeAbv(ogForAbv, fgForAbv);
    // Per-addition IBU lookup keyed by index, since duplicate hop names exist.
    const boilHopIndices = (recipe.ingredients.hop_additions ?? [])
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h.timing?.use === "add_to_boil")
      .map(({ i }) => i);
    const ibuByIndex = new Map<number, number>();
    boilHopIndices.forEach((idx, k) => {
      ibuByIndex.set(idx, ibu.additions[k]?.ibu ?? 0);
    });
    return { ibu, water, color, gravity, fg: fgEstimate, abv, ibuByIndex };
  }, [recipe, activeProfile, prefs.ibu_method, prefs.color_method]);

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
  const computedFgDisplay = formatSpecificGravity(computed.fg, prefs).display;

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
      current: claimedFgSg ?? computed.fg,
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
            <span aria-hidden>←</span> {t("recipe.back_library")}
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
                {hasActiveSession ? t("recipe.resume_brewing") : t("recipe.start_brewing")}
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
                {t("recipe.edit")}
              </button>
            )}
            <ExportMenu recipe={recipe} prefs={prefs} />
          </div>
        </header>

        {/* ─── Targets vs computed strip ───────────────────────────────── */}
        {/* Display rule, applied to every tile: if the file declares a
            value, that's the main number and our compute appears as
            "≈x" below it for a sanity check. If the file is silent,
            we show our compute as the main number with no subtitle —
            displaying "—" with the estimate as a tiny subtitle hides
            the answer the brewer is actually looking for. */}
        <section className="mb-8 sm:mb-10 lg:mb-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-px bg-border rounded-xl overflow-hidden">
          <Tile
            label="OG"
            value={claimedOgSg !== null ? claimedOgDisplay : computedOgDisplay}
            sub={claimedOgSg !== null ? `≈${computedOgDisplay}` : undefined}
            warn={
              claimedOgSg !== null &&
              Math.abs(computed.gravity.og - claimedOgSg) > 0.008
            }
            styleHint={styleHints.og}
          />
          <Tile
            label="FG"
            value={claimedFgSg !== null ? claimedFgDisplay : computedFgDisplay}
            sub={claimedFgSg !== null ? `≈${computedFgDisplay}` : undefined}
            warn={
              claimedFgSg !== null && Math.abs(computed.fg - claimedFgSg) > 0.005
            }
            styleHint={styleHints.fg}
          />
          <Tile
            label="IBU"
            value={(claimedIbu ?? computed.ibu.total_ibu).toFixed(0)}
            sub={claimedIbu !== null ? `≈${computed.ibu.total_ibu.toFixed(0)}` : undefined}
            warn={claimedIbu !== null && Math.abs(computed.ibu.total_ibu - claimedIbu) > 15}
            styleHint={styleHints.ibu}
          />
          <Tile
            label="ABV"
            value={`${(claimedAbv ?? computed.abv).toFixed(1)}%`}
            sub={claimedAbv !== null ? `≈${computed.abv.toFixed(1)}%` : undefined}
            warn={
              claimedAbv !== null && Math.abs(computed.abv - claimedAbv) > 0.5
            }
            styleHint={styleHints.abv}
          />
          <Tile
            label="Color"
            value={claimedColorDisplay ?? computedColorDisplay}
            sub={claimedColorDisplay !== null ? `≈${computedColorDisplay}` : undefined}
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
          title={t("recipe.section.water")}
          {...(activeProfile?.mash_mode === "biab" && {
            subtitle: t("recipe.water.biab_hint"),
          })}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
            <Tile label="Mash" value={formatLiters(computed.water.mash_water_l, prefs).display} />
            <Tile label="Sparge" value={formatLiters(computed.water.sparge_water_l, prefs).display} />
            <Tile label="Pre-boil" value={formatLiters(computed.water.pre_boil_volume_l, prefs).display} />
            <Tile label="Total water" value={formatLiters(computed.water.total_water_l, prefs).display} highlight />
          </div>
        </Section>

        {/* ─── Fermentables ────────────────────────────────────────────── */}
        <Section title={t("recipe.section.fermentables")}>
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
          title={t("recipe.section.hops")}
          subtitle={t("recipe.section.hops_subtitle")}
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
            <Section title={t("recipe.section.miscs")}>
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
            title={t("recipe.section.mash")}
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
            <Section title={t("recipe.section.cultures")}>
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
  const t = useT();
  const [open, setOpen] = useState(false);

  const run = async (fn: () => Promise<{ error?: WerbError | undefined }>) => {
    setOpen(false);
    const r = await fn();
    if (r.error) alert(translateError(r.error, t));
  };

  const options: {
    label: string;
    sublabel: string;
    fn: () => Promise<{ error?: WerbError | undefined }>;
  }[] = [
    {
      label: t("recipe.export.beerjson_label"),
      sublabel: t("recipe.export.beerjson_sub"),
      fn: () => exportBeerJson(recipe),
    },
    {
      label: t("recipe.export.beerxml_label"),
      sublabel: t("recipe.export.beerxml_sub"),
      fn: () => exportBeerXml(recipe),
    },
    {
      label: t("recipe.export.html_label"),
      sublabel: t("recipe.export.html_sub"),
      fn: () => exportRecipeHtml(recipe, prefs),
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-4 py-3 rounded-xl bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent transition-colors flex items-center gap-2"
      >
        {t("recipe.export.button")}
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

// ─── Cost estimator ────────────────────────────────────────────────────────
//
// Approximate batch cost from the bundled default price table. Brewers
// adjust the global "Cost adjustment" coefficient in Settings to match
// their local market — single knob, no per-ingredient maintenance.

const CATEGORY_KEY: Record<CostLine["category"], string> = {
  fermentable: "recipe.cost.category.fermentable",
  hop: "recipe.cost.category.hop",
  culture: "recipe.cost.category.culture",
  misc: "recipe.cost.category.misc",
};

function CostSection({ recipe }: { recipe: BeerJsonRecipe }) {
  const prefs = useUnits();
  const tt = useT();
  const breakdown = useMemo(
    () => computeRecipeCost(recipe, prefs.cost_inflation_pct),
    [recipe, prefs.cost_inflation_pct],
  );

  if (breakdown.total_count === 0) return null;

  const inflationNote =
    prefs.cost_inflation_pct === 100
      ? tt("recipe.cost.note_default")
      : tt("recipe.cost.note_inflated", { pct: prefs.cost_inflation_pct });

  return (
    <Section title={tt("recipe.section.cost")} subtitle={inflationNote}>
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
            label={tt("recipe.cost.batch_total")}
            value={formatMoney(breakdown.total, prefs)}
            tone="highlight"
          />
          <CostStat
            label={tt("recipe.cost.per_unit", { unit: formatLiters(1, prefs).unit })}
            value={formatMoney(breakdown.per_liter, prefs)}
          />
          <CostStat
            label={tt("recipe.cost.per_bottle")}
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
  const t = useT();
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
          {t(CATEGORY_KEY[line.category])}
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
  const t = useT();
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
      t("recipe.scale.line_batch", { from: fromBatchDisplay, to: targetBatchDisplay }),
      fromEff !== null
        ? t("recipe.scale.line_efficiency", { from: fromEff, to: profile.efficiency_pct })
        : null,
      fit.capped
        ? t("recipe.scale.line_capped", {
            from: formatLiters(fit.capped.from_l, prefs).display,
            to: formatLiters(fit.capped.to_l, prefs).display,
            capacity: profile.mash_tun
              ? formatLiters(profile.mash_tun.capacity_l, prefs).display
              : "",
          })
        : null,
    ].filter(Boolean);

    if (
      confirm(
        t("recipe.scale.confirm", { name: profile.name, lines: lines.join("\n") }),
      )
    ) {
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
          ? t("recipe.scale.noop_tooltip")
          : t("recipe.scale.active_tooltip", {
              name: profile.name,
              batch: targetBatchDisplay,
              eff: profile.efficiency_pct,
            })
      }
      className="px-4 py-3 rounded-xl bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {t("recipe.scale.button")}
    </button>
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

