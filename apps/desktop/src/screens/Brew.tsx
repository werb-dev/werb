import { useMemo } from "react";
import {
  isMass,
  recipeToWaterInput,
  toGrams,
  toKilograms,
  toMinutes,
  type BeerJsonRecipe,
} from "@werb/adapters";
import type { SessionStep, WaterOutput } from "@werb/types";
import { computeWater } from "@werb/calc";
import { useBrewSession, useScreenWakeLock, useTick } from "../hooks/useBrewSession.ts";
import { profileToWaterOverrides, type ProfileWithId } from "../data/equipment.ts";
import { useBcp47, useT, useUnits } from "../data/preferences.tsx";
import {
  formatCelsius,
  formatLiters,
  formatMassLarge,
  type UnitPreferences,
} from "../data/units-format.ts";
import {
  cultureFormLabel,
  cultureTypeLabel,
  fermentableTypeLabel,
} from "../data/enum-labels.ts";
import { HopSchedule } from "./Brew/HopSchedule.tsx";
import { MeasurementsSection } from "./Brew/MeasurementsSection.tsx";
import { Section } from "./Brew/Section.tsx";
import { TastingSection } from "./Brew/TastingSection.tsx";
import { formatDuration, stepTitle } from "./Brew/format.ts";

interface BrewScreenProps {
  recipeId: string;
  recipe: BeerJsonRecipe;
  /**
   * Optional: load this specific session (Journal flow). When absent,
   * the screen finds the live session for the recipe or offers to
   * start one.
   */
  sessionId?: string | undefined;
  activeProfile?: ProfileWithId | undefined;
  onBack: () => void;
  /**
   * Label for the back-button arrow. Decided by the caller so the
   * label and the actual destination of [`onBack`] stay in sync —
   * the active-session route falls back to the Recipe screen, the
   * journal-entry route falls back to the Journal, and the label
   * needs to match.
   */
  backLabel: string;
}

export interface BoilHop {
  name: string;
  amount_g: number;
  alpha_acid_pct: number;
  time_min: number;
  notes: string | undefined;
}

export interface MashFermentable {
  name: string;
  type: string;
  amount_kg: number;
}

interface BrewContext {
  water: WaterOutput;
  totalGrainKg: number;
  totalMashedKg: number;
  mashFermentables: MashFermentable[];
  boilHops: BoilHop[];
  cultures: BeerJsonRecipe["ingredients"]["culture_additions"];
  hltFit: HltFit | null;
  kettleFit: KettleFit | null;
}

/**
 * Verdict on whether the HLT can hold the planned water.
 *
 * The brewer heats strike water first, drains it to the mash tun, then heats
 * sparge water in the same vessel. So the binding constraint is the *larger*
 * of the two volumes, not their sum — a combined check is informational only.
 */
type HltFit =
  | { kind: "ok" }
  | { kind: "two_heats"; strikeL: number; spargeL: number; capacityL: number }
  | { kind: "overflow"; volumeL: number; capacityL: number; which: "strike" | "sparge" };

type KettleFit =
  | { kind: "ok" }
  | { kind: "overflow"; preBoilL: number; capacityL: number };

function checkHltFit(water: WaterOutput, profile: ProfileWithId | undefined): HltFit | null {
  const capacityL = profile?.hlt?.capacity_l;
  if (!capacityL || capacityL <= 0) return null;
  const usableL = capacityL - (profile.hlt?.dead_space_l ?? 0);
  const strikeL = water.mash_water_l;
  const spargeL = water.sparge_water_l;
  if (strikeL > usableL) return { kind: "overflow", volumeL: strikeL, capacityL: usableL, which: "strike" };
  if (spargeL > usableL) return { kind: "overflow", volumeL: spargeL, capacityL: usableL, which: "sparge" };
  if (strikeL + spargeL > usableL) return { kind: "two_heats", strikeL, spargeL, capacityL: usableL };
  return { kind: "ok" };
}

function checkKettleFit(water: WaterOutput, profile: ProfileWithId | undefined): KettleFit | null {
  const capacityL = profile?.kettle?.capacity_l;
  if (!capacityL || capacityL <= 0) return null;
  const usableL = capacityL - (profile.kettle?.dead_space_l ?? 0);
  const preBoilL = water.pre_boil_volume_l;
  if (preBoilL > usableL) return { kind: "overflow", preBoilL, capacityL: usableL };
  return { kind: "ok" };
}

export function BrewScreen({ recipeId, recipe, sessionId, activeProfile, onBack, backLabel }: BrewScreenProps) {
  const brew = useBrewSession(recipeId, recipe, sessionId);
  const tick = useTick(1000);
  const wakeLockHeld = useScreenWakeLock(brew.session?.status === "in_progress");
  const prefs = useUnits();
  const t = useT();

  const ctx = useMemo<BrewContext>(() => {
    const water = computeWater(recipeToWaterInput(recipe, profileToWaterOverrides(activeProfile)));
    const fermentables = recipe.ingredients.fermentable_additions;
    const totalGrainKg = fermentables.reduce(
      (sum, f) => sum + (isMass(f.amount) ? toKilograms(f.amount) : 0),
      0,
    );
    const totalMashedKg = fermentables
      .filter((f) => f.type === "grain" && isMass(f.amount))
      .reduce((sum, f) => sum + toKilograms(f.amount as Parameters<typeof toKilograms>[0]), 0);
    const mashFermentables: MashFermentable[] = fermentables
      .filter((f) => isMass(f.amount))
      .map((f) => ({
        name: f.name,
        type: f.type,
        amount_kg: toKilograms(f.amount as Parameters<typeof toKilograms>[0]),
      }));
    const boilHops: BoilHop[] = (recipe.ingredients.hop_additions ?? [])
      .filter((h) => h.timing?.use === "add_to_boil")
      .map((h) => ({
        name: h.name,
        amount_g: isMass(h.amount) ? toGrams(h.amount) : 0,
        alpha_acid_pct: h.alpha_acid?.value ?? 0,
        time_min: h.timing?.time ? toMinutes(h.timing.time) : 0,
        notes: h.notes,
      }));
    const cultures = recipe.ingredients.culture_additions;
    const hltFit = checkHltFit(water, activeProfile);
    const kettleFit = checkKettleFit(water, activeProfile);
    return { water, totalGrainKg, totalMashedKg, mashFermentables, boilHops, cultures, hltFit, kettleFit };
  }, [recipe, activeProfile]);

  if (!brew.session) {
    const biab = activeProfile?.mash_mode === "biab";
    return (
      <NoSession
        onBack={onBack}
        recipe={recipe}
        onStart={() => brew.start({ biab })}
      />
    );
  }

  const { session, activeStep } = brew;

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Header
          recipe={recipe}
          session={session}
          wakeLockHeld={wakeLockHeld}
          onBack={onBack}
          backLabel={backLabel}
        />

        {ctx.hltFit && ctx.hltFit.kind !== "ok" && <HltFitBanner fit={ctx.hltFit} prefs={prefs} />}
        {ctx.kettleFit && ctx.kettleFit.kind !== "ok" && <KettleFitBanner fit={ctx.kettleFit} prefs={prefs} />}

        {activeStep ? (
          <ActiveStepCard
            step={activeStep}
            now={tick}
            ctx={ctx}
            sessionId={session.id}
            onFinish={() => brew.finishStep(activeStep.id)}
            prefs={prefs}
          />
        ) : session.status === "completed" ? (
          <CompletedCard session={session} />
        ) : (
          <StartHint />
        )}

        <Section title={t("brew.timeline")}>
          <ol className="rounded-xl bg-surface border border-border divide-y divide-border">
            {session.steps.map((step) => (
              <TimelineRow
                key={step.id}
                step={step}
                now={tick}
                isActive={step.id === activeStep?.id}
                ctx={ctx}
                onStart={() => brew.startStep(step.id)}
                onFinish={() => brew.finishStep(step.id)}
                onNotes={(notes) => brew.setStepNotes(step.id, notes)}
                disabled={session.status === "completed"}
                prefs={prefs}
              />
            ))}
          </ol>
        </Section>

        <MeasurementsSection
          session={session}
          onAdd={brew.addMeasurement}
          onRemove={brew.removeMeasurement}
          disabled={session.status === "completed"}
        />

        {session.status === "completed" && (
          <TastingSection
            tasting={session.tasting}
            onSave={brew.setTasting}
          />
        )}

        <div className="mt-10 sm:mt-12 flex flex-wrap gap-3 justify-between">
          {session.status !== "completed" ? (
            <button
              onClick={brew.completeSession}
              className="px-5 py-3 rounded-lg bg-success text-bg text-body-sm font-medium hover:opacity-90 transition-opacity min-h-[44px]"
            >
              {t("brew.complete_session")}
            </button>
          ) : (
            <span className="text-body-sm text-text-muted">
              {t("brew.session_completed")}
            </span>
          )}
          <button
            onClick={() => {
              if (confirm(t("brew.discard_confirm"))) {
                brew.abandon();
              }
            }}
            className="px-5 py-3 rounded-lg bg-surface-raised border border-border text-text-muted text-body-sm font-medium hover:text-danger hover:border-danger transition-colors min-h-[44px]"
          >
            {t("brew.discard_session")}
          </button>
        </div>
      </main>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────

function Header({
  recipe,
  session,
  wakeLockHeld,
  onBack,
  backLabel,
}: {
  recipe: BeerJsonRecipe;
  session: { status: string; started_at: string };
  wakeLockHeld: boolean;
  onBack: () => void;
  backLabel: string;
}) {
  const t = useT();
  const localeTag = useBcp47();
  return (
    <header className="mb-8 sm:mb-10">
      <button
        onClick={onBack}
        className="text-caption font-medium text-text-muted hover:text-text transition-colors flex items-center gap-2"
      >
        <span aria-hidden>←</span> {backLabel}
      </button>
      <div className="mt-5 sm:mt-6 flex items-start justify-between gap-3 sm:gap-6">
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-widest text-accent font-medium">
            {t("brew.session_label", {
              status: t(`brew.status.${session.status}`),
            })}
          </p>
          <h1 className="text-h2 sm:text-h1 font-semibold mt-2 capitalize break-words">
            {recipe.name.toLowerCase()}
          </h1>
          <p className="text-body-sm text-text-muted mt-2 font-mono">
            {t("brew.started_at", { time: new Date(session.started_at).toLocaleString(localeTag) })}
          </p>
        </div>
        <WakeLockBadge held={wakeLockHeld} />
      </div>
    </header>
  );
}

function HltFitBanner({
  fit,
  prefs,
}: {
  fit: Exclude<HltFit, { kind: "ok" }>;
  prefs: UnitPreferences;
}) {
  const t = useT();
  const vol = (l: number) => formatLiters(l, prefs).display;
  if (fit.kind === "overflow") {
    const bodyKey =
      fit.which === "strike" ? "brew.hlt.overflow.strike" : "brew.hlt.overflow.sparge";
    return (
      <section className="mb-6 sm:mb-8 rounded-xl border border-danger bg-danger/10 px-4 sm:px-5 py-3 sm:py-4">
        <p className="text-caption uppercase tracking-widest text-danger font-medium">
          {t("brew.hlt.too_small")}
        </p>
        <p className="text-body-sm text-text mt-1">
          {t(bodyKey, { volume: vol(fit.volumeL), capacity: vol(fit.capacityL) })}
        </p>
      </section>
    );
  }
  return (
    <section className="mb-6 sm:mb-8 rounded-xl border border-warning bg-warning/10 px-4 sm:px-5 py-3 sm:py-4">
      <p className="text-caption uppercase tracking-widest text-warning font-medium">
        {t("brew.hlt.two_heats.title")}
      </p>
      <p className="text-body-sm text-text mt-1">
        {t("brew.hlt.two_heats.body", {
          strike: vol(fit.strikeL),
          sparge: vol(fit.spargeL),
          total: vol(fit.strikeL + fit.spargeL),
          capacity: vol(fit.capacityL),
        })}
      </p>
    </section>
  );
}

function KettleFitBanner({
  fit,
  prefs,
}: {
  fit: Exclude<KettleFit, { kind: "ok" }>;
  prefs: UnitPreferences;
}) {
  const t = useT();
  const vol = (l: number) => formatLiters(l, prefs).display;
  return (
    <section className="mb-6 sm:mb-8 rounded-xl border border-danger bg-danger/10 px-4 sm:px-5 py-3 sm:py-4">
      <p className="text-caption uppercase tracking-widest text-danger font-medium">
        {t("brew.kettle.too_small")}
      </p>
      <p className="text-body-sm text-text mt-1">
        {t("brew.kettle.overflow", {
          preBoil: vol(fit.preBoilL),
          capacity: vol(fit.capacityL),
        })}
      </p>
    </section>
  );
}

function WakeLockBadge({ held }: { held: boolean }) {
  const t = useT();
  return (
    <span
      className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-pill text-caption font-mono border ${
        held ? "border-success text-success" : "border-border text-text-muted"
      }`}
    >
      <span
        aria-hidden
        className={`block w-2 h-2 rounded-pill ${held ? "bg-success" : "bg-text-muted"}`}
      />
      {held ? t("brew.wake") : t("brew.sleep")}
    </span>
  );
}

function ActiveStepCard({
  step,
  now,
  ctx,
  sessionId,
  onFinish,
  prefs,
}: {
  step: SessionStep;
  now: number;
  ctx: BrewContext;
  sessionId: string;
  onFinish: () => void;
  prefs: UnitPreferences;
}) {
  const t = useT();
  const elapsedSec = step.started_at
    ? Math.floor((now - new Date(step.started_at).getTime()) / 1000)
    : 0;
  const target = step.target_duration_min ?? null;
  const targetSec = target !== null ? target * 60 : null;
  const remaining = targetSec !== null ? targetSec - elapsedSec : null;
  const overrun = remaining !== null && remaining < 0;

  return (
    <section className="mb-8 sm:mb-10 rounded-2xl bg-surface border border-border p-5 sm:p-7 lg:p-8">
      <div className="flex items-baseline justify-between gap-3 sm:gap-6">
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            {t(`brew.kind.${step.kind}`)}
          </p>
          <h2 className="text-h3 sm:text-h2 font-semibold mt-2 capitalize break-words">
            {stepTitle(step, t)}
          </h2>
        </div>
        <div className="text-right shrink-0">
          <p
            className={`font-mono text-h1 sm:text-display tabular-nums ${
              overrun ? "text-warning" : "text-accent"
            }`}
          >
            {remaining !== null ? formatDuration(Math.abs(remaining)) : formatDuration(elapsedSec)}
          </p>
          <p className="font-mono text-caption text-text-muted mt-1">
            {target !== null
              ? overrun
                ? t("brew.stat.overrun")
                : `${formatDuration(elapsedSec)} / ${target} min`
              : `${t("brew.stat.elapsed")} ${formatDuration(elapsedSec)}`}
          </p>
        </div>
      </div>

      <StepInfo step={step} ctx={ctx} elapsedSec={elapsedSec} variant="active" sessionId={sessionId} prefs={prefs} />

      <button
        onClick={onFinish}
        className="mt-6 w-full px-5 py-4 rounded-xl bg-accent text-bg text-body-lg font-medium hover:opacity-90 transition-opacity"
      >
        {t("brew.mark_done")}
      </button>
    </section>
  );
}

/**
 * Renders the per-kind context numbers for a step. The active step shows a
 * larger version (variant="active"); timeline rows show a compact line
 * (variant="row").
 */
function StepInfo({
  step,
  ctx,
  elapsedSec,
  variant,
  sessionId,
  prefs,
}: {
  step: SessionStep;
  ctx: BrewContext;
  elapsedSec: number;
  variant: "active" | "row";
  sessionId?: string | undefined;
  prefs: UnitPreferences;
}) {
  const t = useT();
  const stats = stepStats(step, ctx, prefs, t);
  const showHops = step.kind === "boil" && variant === "active" && ctx.boilHops.length > 0;
  const showCultures =
    step.kind === "ferment_pitch" && variant === "active" && ctx.cultures && ctx.cultures.length > 0;
  const showMashIn =
    step.kind === "mash_in" && variant === "active" && ctx.mashFermentables.length > 0;

  if (stats.length === 0 && !showHops && !showCultures && !showMashIn && step.target_temperature_c === undefined) {
    return null;
  }

  if (variant === "active") {
    return (
      <div className="mt-6 space-y-4 sm:space-y-5">
        {(stats.length > 0 || step.target_temperature_c !== undefined) && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {step.target_temperature_c !== undefined && (
              <StatTile
                value={formatCelsius(step.target_temperature_c, prefs).display}
                label={t("brew.stat.target")}
                tone="data"
              />
            )}
            {stats.map((s, i) => (
              <StatTile key={i} value={s.value} label={s.label} tone={s.tone} />
            ))}
          </div>
        )}
        {showHops && (
          <HopSchedule
            hops={ctx.boilHops}
            boilDurationMin={step.target_duration_min ?? 60}
            elapsedSec={elapsedSec}
            storageKey={`werb.session.${sessionId}.hopAdded.${step.id}`}
            prefs={prefs}
          />
        )}
        {showCultures && <CultureList cultures={ctx.cultures!} prefs={prefs} />}
        {showMashIn && <MashInList items={ctx.mashFermentables} prefs={prefs} />}
      </div>
    );
  }

  // Compact row variant: small font, comma-separated.
  const inline: string[] = [];
  if (step.target_temperature_c !== undefined) {
    inline.push(formatCelsius(step.target_temperature_c, prefs).display);
  }
  if (step.target_duration_min !== undefined) {
    inline.push(`${step.target_duration_min} min`);
  }
  for (const s of stats) inline.push(`${s.value} ${s.label.toLowerCase()}`);
  if (inline.length === 0) return null;
  return (
    <p className="font-mono text-caption text-text-muted mt-1">
      {inline.join(" · ")}
    </p>
  );
}

interface StatLine {
  value: string;
  label: string;
  tone?: "default" | "data" | "accent";
}

type Translator = (key: string, vars?: Record<string, string | number>) => string;

function stepStats(
  step: SessionStep,
  ctx: BrewContext,
  prefs: UnitPreferences,
  t: Translator,
): StatLine[] {
  // Helpers: format raw L / kg with the user's pref. "Thickness"
  // L/kg → gal/lb conversion isn't standard — Anglo-American brewers
  // usually still talk thickness in qt/lb. We keep L/kg as a
  // metric-only unit for now since it has no clean "imperial
  // homebrew" equivalent.
  const vol = (l: number) => formatLiters(l, prefs).display;
  const mass = (kg: number) =>
    formatMassLarge({ value: kg, unit: "kg" }, prefs).display;

  switch (step.kind) {
    case "prepare_water":
      // Strike volume + a thickness reminder so the brewer can sanity-check
      // before pouring.
      if (ctx.totalMashedKg <= 0) return [];
      return [
        { value: vol(ctx.water.mash_water_l), label: t("brew.stat.strike_volume") },
        {
          value: `${(ctx.water.mash_water_l / ctx.totalMashedKg).toFixed(2)} ${t("brew.thickness_unit")}`,
          label: t("brew.stat.thickness"),
        },
      ];
    case "mash_in":
      if (ctx.totalMashedKg <= 0) return [];
      return [
        { value: mass(ctx.totalMashedKg), label: t("brew.stat.total_grain") },
        { value: `${ctx.mashFermentables.length}`, label: t("brew.stat.items") },
      ];
    case "mash":
      if (ctx.totalMashedKg <= 0) return [];
      return [
        { value: vol(ctx.water.mash_water_l), label: t("brew.stat.strike_water") },
        { value: mass(ctx.totalMashedKg), label: t("brew.stat.grain") },
        {
          value: `${(ctx.water.mash_water_l / ctx.totalMashedKg).toFixed(2)} ${t("brew.thickness_unit")}`,
          label: t("brew.stat.thickness"),
        },
      ];
    case "sparge":
      return [
        {
          value: ctx.water.sparge_water_l > 0 ? vol(ctx.water.sparge_water_l) : "—",
          label: t("brew.stat.sparge_water"),
        },
        { value: vol(ctx.water.pre_boil_volume_l), label: t("brew.stat.pre_boil_target") },
        { value: vol(ctx.water.grain_absorption_l), label: t("brew.stat.absorbed") },
      ];
    case "boil":
      return [
        { value: vol(ctx.water.pre_boil_volume_l), label: t("brew.stat.pre_boil") },
        { value: vol(ctx.water.boil_off_l), label: t("brew.stat.boil_off") },
        { value: `${ctx.boilHops.length}`, label: t("brew.stat.hop_additions") },
      ];
    case "chill":
      return [
        { value: vol(ctx.water.post_cool_kettle_volume_l), label: t("brew.stat.in_kettle") },
      ];
    case "transfer":
      return [
        {
          value: vol(ctx.water.post_cool_kettle_volume_l - 0.5),
          label: t("brew.stat.to_fermenter"),
        },
      ];
    default:
      return [];
  }
}

function StatTile({
  value,
  label,
  tone = "default",
}: {
  value: string;
  label: string;
  tone?: "default" | "data" | "accent" | undefined;
}) {
  const valueColor =
    tone === "data" ? "text-data" : tone === "accent" ? "text-accent" : "text-text";
  return (
    <div className="rounded-lg bg-surface-raised border border-border px-3 py-3 sm:px-4">
      <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted truncate">{label}</p>
      <p className={`font-mono text-body sm:text-h3 mt-1 tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}


function MashInList({
  items,
  prefs,
}: {
  items: MashFermentable[];
  prefs: UnitPreferences;
}) {
  const t = useT();
  return (
    <div className="rounded-lg bg-bg border border-border p-4">
      <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
        {t("brew.grain_bill.title")}
      </p>
      <ul className="space-y-2">
        {items.map((f, i) => (
          <li key={i} className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <p className="text-body-sm font-medium truncate">{f.name}</p>
              <p className="text-caption text-text-muted capitalize">{fermentableTypeLabel(t, f.type)}</p>
            </div>
            <p className="font-mono text-mono-lg shrink-0 tabular-nums">
              {formatMassLarge({ value: f.amount_kg, unit: "kg" }, prefs).display}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CultureList({
  cultures,
  prefs: _prefs,
}: {
  cultures: NonNullable<BeerJsonRecipe["ingredients"]["culture_additions"]>;
  // Currently unused — culture amounts come through as
  // {value, unit} (mass / volume / pkg) that the Brew screen renders
  // as-is. Hooks into the formatter later if we want to convert
  // pkg → g or similar.
  prefs: UnitPreferences;
}) {
  const t = useT();
  return (
    <div className="rounded-lg bg-bg border border-border p-4">
      <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
        {t("brew.culture.title")}
      </p>
      <ul className="space-y-2">
        {cultures.map((c, i) => (
          <li key={i} className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-body-sm font-medium">{c.name}</p>
              <p className="text-caption text-text-muted">
                {cultureFormLabel(t, c.form)} · {cultureTypeLabel(t, c.type)}
                {c.producer && ` · ${c.producer}`}
                {c.product_id && ` · ${c.product_id}`}
                {c.attenuation && ` · ${t("brew.culture.atten", { pct: c.attenuation.value })}`}
              </p>
            </div>
            <p className="font-mono text-mono-lg shrink-0">
              {c.amount ? `${c.amount.value} ${c.amount.unit}` : "—"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimelineRow({
  step,
  now,
  isActive,
  ctx,
  onStart,
  onFinish,
  onNotes,
  disabled,
  prefs,
}: {
  step: SessionStep;
  now: number;
  isActive: boolean;
  ctx: BrewContext;
  onStart: () => void;
  onFinish: () => void;
  onNotes: (notes: string) => void;
  disabled: boolean;
  prefs: UnitPreferences;
}) {
  const t = useT();
  const localeTag = useBcp47();
  const icon =
    step.status === "done"
      ? "✓"
      : step.status === "active"
      ? "▶"
      : step.status === "skipped"
      ? "−"
      : "○";
  const elapsedSec =
    step.status === "active" && step.started_at
      ? Math.floor((now - new Date(step.started_at).getTime()) / 1000)
      : 0;

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <span
          aria-hidden
          className={`shrink-0 w-6 sm:w-7 mt-0.5 text-h4 text-center font-mono ${
            step.status === "done"
              ? "text-success"
              : step.status === "active"
              ? "text-accent"
              : "text-text-muted"
          }`}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-body font-medium break-words">{stepTitle(step, t)}</p>
          </div>
          <StepInfo step={step} ctx={ctx} elapsedSec={elapsedSec} variant="row" prefs={prefs} />
          {step.status === "active" && elapsedSec > 0 && (
            <p className="font-mono text-caption text-accent mt-1 tabular-nums">
              {t("brew.step_elapsed", { duration: formatDuration(elapsedSec) })}
            </p>
          )}
          {step.completed_at && step.started_at && (
            <p className="font-mono text-caption text-text-muted mt-1">
              {t("brew.step_finished", {
                duration: formatDuration(
                  Math.floor(
                    (new Date(step.completed_at).getTime() -
                      new Date(step.started_at).getTime()) /
                      1000,
                  ),
                ),
                time: new Date(step.completed_at).toLocaleTimeString(localeTag),
              })}
            </p>
          )}
          {isActive && (
            <textarea
              defaultValue={step.notes ?? ""}
              onBlur={(e) => onNotes(e.target.value)}
              placeholder={t("brew.step_notes_placeholder")}
              rows={2}
              className="mt-3 w-full bg-bg border border-border rounded-lg px-3 py-2 text-body-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          )}
          {!isActive && step.notes && (
            <p className="text-body-sm text-text-muted mt-2 whitespace-pre-wrap">
              {step.notes}
            </p>
          )}
        </div>
        {!disabled && (
          <div className="shrink-0">
            {step.status === "pending" && (
              <button
                onClick={onStart}
                className="px-3 py-2 sm:py-1.5 rounded-lg bg-surface-raised border border-border text-caption font-medium hover:border-accent hover:text-accent transition-colors min-h-[36px]"
              >
                {t("brew.start_step")}
              </button>
            )}
            {step.status === "active" && (
              <button
                onClick={onFinish}
                className="px-3 py-2 sm:py-1.5 rounded-lg bg-accent text-bg text-caption font-medium hover:opacity-90 transition-opacity min-h-[36px]"
              >
                {t("brew.done_step")}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function NoSession({
  onBack,
  recipe,
  onStart,
}: {
  onBack: () => void;
  recipe: BeerJsonRecipe;
  onStart: () => void;
}) {
  const t = useT();
  return (
    <div className="min-h-dvh bg-bg text-text flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <h2 className="text-h2 font-semibold capitalize">{recipe.name.toLowerCase()}</h2>
        <p className="text-body text-text-muted mt-3">{t("brew.no_session.body")}</p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={onStart}
            className="px-5 py-4 rounded-xl bg-accent text-bg text-body-lg font-medium hover:opacity-90 transition-opacity"
          >
            {t("brew.no_session.start")}
          </button>
          <button
            onClick={onBack}
            className="px-5 py-2 text-caption text-text-muted hover:text-text transition-colors"
          >
            {t("brew.no_session.back")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletedCard({
  session,
}: {
  session: { completed_at?: string; started_at: string };
}) {
  const t = useT();
  const total = session.completed_at
    ? Math.floor(
        (new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000,
      )
    : 0;
  return (
    <section className="mb-10 rounded-2xl bg-surface border border-success p-8 text-center">
      <p className="text-caption uppercase tracking-widest text-success font-medium">
        {t("brew.completed_label")}
      </p>
      <p className="font-mono text-display text-success mt-3">{formatDuration(total)}</p>
      <p className="font-mono text-caption text-text-muted mt-1">{t("brew.total_brew_time")}</p>
    </section>
  );
}

function StartHint() {
  const t = useT();
  return (
    <section className="mb-10 rounded-2xl bg-surface border border-border border-dashed p-8 text-center">
      <p className="text-body text-text-muted">
        {t("brew.start_hint", { start: t("brew.start_step") })}
      </p>
    </section>
  );
}




