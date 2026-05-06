import { useMemo } from "react";
import {
  recipeToIbuInput,
  recipeToWaterInput,
  recipeToColorInput,
  recipeToGravityInput,
  recipeToScaleInput,
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
import { computeIbu, computeWater, computeAbv, computeColor, computeGravity, computeScale } from "@werb/calc";
import { profileToWaterOverrides, type ProfileWithId } from "../data/equipment.ts";

const TIMING_LABEL: Record<string, string> = {
  add_to_boil: "Boil",
  add_to_fermentation: "Dry hop",
  add_to_mash: "Mash",
  add_to_package: "Package",
};

interface RecipeScreenProps {
  recipe: BeerJsonRecipe;
  activeProfile?: ProfileWithId | undefined;
  onBack?: (() => void) | undefined;
  onStartBrewing?: (() => void) | undefined;
  onApplyScaled?: ((scaled: BeerJsonRecipe) => void) | undefined;
  hasActiveSession?: boolean | undefined;
}

export function RecipeScreen({ recipe, activeProfile, onBack, onStartBrewing, onApplyScaled, hasActiveSession }: RecipeScreenProps) {
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
  const claimedAbv = recipe.alcohol_by_volume?.value ?? null;
  const claimedSrm = recipe.color_estimate ? toSrm(recipe.color_estimate) : null;
  const claimedColorDisplay = recipe.color_estimate
    ? `${recipe.color_estimate.value.toFixed(0)} ${recipe.color_estimate.unit}`
    : null;
  const computedColorDisplay =
    recipe.color_estimate?.unit === "EBC"
      ? `${computed.color.ebc.toFixed(0)} EBC`
      : `${computed.color.srm.toFixed(1)} SRM`;

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
          />
          <Tile label="FG" value={recipe.final_gravity?.value.toFixed(3) ?? "—"} />
          <Tile
            label="IBU"
            value={claimedIbu?.toString() ?? "—"}
            sub={`≈${computed.ibu.total_ibu.toFixed(0)}`}
            warn={claimedIbu !== null && Math.abs(computed.ibu.total_ibu - claimedIbu) > 15}
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
          />
          <Tile
            label="Color"
            value={claimedColorDisplay ?? "—"}
            sub={`≈${computedColorDisplay}`}
            warn={
              claimedSrm !== null && Math.abs(computed.color.srm - claimedSrm) > 3
            }
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
          : `Rescale fermentables, hops, yeast and mash water for ${profile.name}, capping strike water to your mash tun if needed.`
      }
      className="px-4 py-3 rounded-xl bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      Adapt to my rig
      <span className="block font-mono text-caption text-text-muted mt-0.5">
        → {profile.batch_size_l} L · {profile.efficiency_pct}%
      </span>
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
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  highlight?: boolean | undefined;
  warn?: boolean | undefined;
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
    </div>
  );
}
