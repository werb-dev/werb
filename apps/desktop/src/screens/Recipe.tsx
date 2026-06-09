import { useMemo, useState } from "react";
import {
  recipeToIbuInput,
  recipeToWaterInput,
  recipeToColorInput,
  recipeToGravityInput,
  recipeToScaleInput,
  applyScale,
  fitMashToTun,
  toLiters,
  toMinutes,
  toSrm,
  toKilograms,
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
  computeBuGu,
  computeGrainBillPct,
} from "@werb/calc";
import { profileToWaterOverrides, type ProfileWithId } from "../data/equipment.ts";
import { exportBeerJson, exportBeerXml, exportRecipeHtml } from "../data/recipe-export.ts";
import { translateError, type WerbError } from "../data/errors.ts";
import { useBrewSessionExists } from "../hooks/useBrewSession.ts";
import { useT, useUnits } from "../data/preferences.tsx";
import {
  cultureFormLabel,
  cultureTypeLabel,
  fermentableTypeLabel,
  hopFormLabel,
  miscTypeLabel,
} from "../data/enum-labels.ts";
import {
  formatColor,
  formatLiters,
  formatMassLarge,
  formatMassSmall,
  formatSpecificGravity,
  formatSrm,
  formatTemperature,
  formatVolume,
  type UnitPreferences,
} from "../data/units-format.ts";
import { Section } from "./Recipe/Section.tsx";
import { Tile } from "./Recipe/Tile.tsx";
import { computeStyleHints } from "./Recipe/styleFit.ts";
import { YeastPitchSection } from "./Recipe/YeastPitchSection.tsx";
import { CarbonationSection } from "./Recipe/CarbonationSection.tsx";
import { CostSection } from "./Recipe/CostSection.tsx";
import { TastingCard } from "./Recipe/TastingCard.tsx";
import { WaterChemistrySection } from "./Recipe/WaterChemistrySection.tsx";

// Hop / misc addition stage → i18n key for the displayed label. The
// dictionary returns a key (not a literal string) so the Recipe
// view's `t()` resolves at render time and the same translations
// power the editor pickers.
const TIMING_KEY: Record<string, string> = {
  add_to_boil: "editor.hop.use.boil",
  add_to_fermentation: "editor.hop.use.dry_hop",
  add_to_mash: "editor.hop.use.mash",
  add_to_package: "editor.hop.use.package",
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
  // BU:GU off the same numbers the strip displays (claimed value preferred).
  const buGu = computeBuGu(
    claimedIbu ?? computed.ibu.total_ibu,
    claimedOgSg ?? computed.gravity.og,
  );
  // Per-fermentable share of the bill by mass, aligned to the ingredient list.
  const grainShares = computeGrainBillPct(
    recipe.ingredients.fermentable_additions.map((f) => ({
      name: f.name,
      mass_kg: isMass(f.amount) ? toKilograms(f.amount) : 0,
    })),
  );

  // BJCP range hints. `current` prefers the recipe's claimed value and falls
  // back to our computed estimate so the indicator works on bare imports.
  // Same helper drives the editor's live banner, so the two views agree.
  const styleHints = computeStyleHints({
    og: claimedOgSg ?? computed.gravity.og,
    fg: claimedFgSg ?? computed.fg,
    ibu: claimedIbu ?? computed.ibu.total_ibu,
    abv: claimedAbv ?? computed.abv,
    srm: claimedSrm ?? computed.color.srm,
    buGu,
    style: recipe.style,
    prefs,
  });

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
            {recipe.boil?.boil_time && ` · ${t("recipe.header.boil_min", { min: toMinutes(recipe.boil.boil_time).toFixed(0) })}`}
            {recipe.efficiency?.brewhouse && ` · ${t("recipe.header.efficiency", { pct: recipe.efficiency.brewhouse.value })}`}
            {recipe.type && ` · ${t(`recipe.type.${recipe.type.replace(" ", "_")}`)}`}
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
        <section className="mb-8 sm:mb-10 lg:mb-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-px bg-border rounded-xl overflow-hidden">
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
          <Tile
            label="BU:GU"
            value={buGu > 0 ? buGu.toFixed(2) : "—"}
            styleHint={buGu > 0 ? styleHints.bu_gu : null}
            testId="targets-bugu"
          />
        </section>

        {/* ─── Most recent tasting ─────────────────────────────────────── */}
        <TastingCard recipeId={recipeId} />

        {/* ─── Computed water strip ────────────────────────────────────── */}
        <Section
          title={t("recipe.section.water")}
          testId="water-volumes"
          {...(activeProfile?.mash_mode === "biab" && {
            subtitle: t("recipe.water.biab_hint"),
          })}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
            <Tile label="Mash" value={formatLiters(computed.water.mash_water_l, prefs).display} />
            <Tile
              label="Sparge"
              value={formatLiters(computed.water.sparge_water_l, prefs).display}
              testId="water-volume-sparge"
            />
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
                      <span className="capitalize">{fermentableTypeLabel(t, f.type)}</span>
                      {f.producer && ` · ${f.producer}`}
                      {colorDisplay && ` · ${colorDisplay}`}
                      {f.yield?.fine_grind && ` · yield ${f.yield.fine_grind.value}%`}
                    </p>
                  </div>
                  <div className="font-mono text-mono-lg shrink-0 text-right">
                    {massDisplay}
                    {grainShares[i] && grainShares[i].pct > 0 && (
                      <span className="block text-body-sm text-text-muted">
                        {grainShares[i].pct.toFixed(1)}%
                      </span>
                    )}
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
              const timingKey = TIMING_KEY[h.timing?.use ?? ""];
              const useLabel = timingKey ? t(timingKey) : "—";
              const time = h.timing?.time ? toMinutes(h.timing.time) : 0;
              const ibuValue = computed.ibuByIndex.get(i);
              return (
                <li key={i} className="px-4 py-4 sm:px-6 sm:py-5 flex items-baseline justify-between gap-3 sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-body font-medium truncate">
                      {h.name}
                      {h.alpha_acid && (
                        <span className="text-text-muted font-mono text-body-sm ml-2">
                          {t("recipe.hop.alpha_acid", { pct: h.alpha_acid.value })}
                        </span>
                      )}
                    </p>
                    <p className="text-body-sm text-text-muted mt-1">
                      {useLabel}
                      {time > 0 && (
                        <>
                          {" · "}
                          {time >= 1440
                            ? t("recipe.time.days", { n: (time / 1440).toFixed(0) })
                            : t("recipe.time.minutes", { n: time.toFixed(0) })}
                        </>
                      )}
                      {h.form && ` · ${hopFormLabel(t, h.form)}`}
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
                  const miscKey = TIMING_KEY[m.timing?.use ?? ""];
                  const useLabel = miscKey ? t(miscKey) : null;
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
                          {m.type && <span className="capitalize">{miscTypeLabel(t, m.type)}</span>}
                          {useLabel && ` · ${useLabel}`}
                          {time > 0 && ` · ${t("recipe.time.minutes", { n: time.toFixed(0) })}`}
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
                    <p className="text-body-sm text-text-muted mt-1">
                      {t(`recipe.mash.type.${step.type}`)}
                      {step.amount && ` · ${t("recipe.mash.infusion", { volume: formatVolume(step.amount, prefs).display })}`}
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
                          {cultureFormLabel(t, c.form)} · {cultureTypeLabel(t, c.type)}
                        </span>
                        {c.producer && ` · ${c.producer}`}
                        {c.product_id && ` · ${c.product_id}`}
                        {c.attenuation && ` · ${t("recipe.culture.attenuation", { pct: c.attenuation.value })}`}
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
        data-testid="export-menu-toggle"
        onClick={() => setOpen((v) => !v)}
        title={t("recipe.export.button_hint")}
        className="px-4 py-3 rounded-xl bg-surface-raised border border-border hover:border-accent hover:text-accent transition-colors flex items-center gap-2"
      >
        <span className="text-body-sm font-medium">{t("recipe.export.button")}</span>
        {/*
          A barely-there format hint solves the discoverability bug
          flagged in #18 — the "Export" button was generic enough that
          a brewer technical enough to want BeerXML missed it. Naming
          the formats inline makes the menu's contents obvious before
          it's opened. Hidden on the narrowest widths so the header
          still fits on a phone.
        */}
        <span className="hidden sm:inline text-caption text-text-muted font-mono">
          {t("recipe.export.button_formats")}
        </span>
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

