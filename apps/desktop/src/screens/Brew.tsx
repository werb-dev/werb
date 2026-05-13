import { useMemo, useState } from "react";
import {
  isMass,
  recipeToWaterInput,
  toGrams,
  toKilograms,
  toMinutes,
  type BeerJsonRecipe,
} from "@werb/adapters";
import type { Measurement, SensoryAxes, SessionStep, Tasting, WaterOutput, WerbSession } from "@werb/types";
import { computeWater } from "@werb/calc";
import { useBrewSession, useScreenWakeLock, useTick } from "../hooks/useBrewSession.ts";
import { profileToWaterOverrides, type ProfileWithId } from "../data/equipment.ts";
import { usePersistedJson } from "../storage/index.ts";
import { useBcp47, useT, useUnits } from "../data/preferences.tsx";
import {
  formatCelsius,
  formatLiters,
  formatMassLarge,
  formatMassSmall,
  type UnitPreferences,
} from "../data/units-format.ts";
import { EMPTY_AXES, SENSORY_AXES, SensoryRadar } from "../components/SensoryRadar.tsx";

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

interface BoilHop {
  name: string;
  amount_g: number;
  alpha_acid_pct: number;
  time_min: number;
  notes: string | undefined;
}

interface MashFermentable {
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
    return <NoSession onBack={onBack} recipe={recipe} onStart={brew.start} />;
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
          <h2 className="text-h3 sm:text-h2 font-semibold mt-2 capitalize break-words">{step.label}</h2>
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

function HopSchedule({
  hops,
  boilDurationMin,
  elapsedSec,
  storageKey,
  prefs,
}: {
  hops: BoilHop[];
  boilDurationMin: number;
  elapsedSec: number;
  storageKey: string;
  prefs: UnitPreferences;
}) {
  const t = useT();
  // Per-hop "added" marks, persisted via the active StorageBackend so
  // they survive a navigation away and back during the boil. Stored as
  // an array (Set isn't JSON-serializable); converted back to a Set for
  // O(1) lookups in the render path.
  const [addedArr, setAddedArr] = usePersistedJson<number[]>(storageKey, []);
  const added = new Set(addedArr);
  const toggle = (i: number) => {
    setAddedArr((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return [...next];
    });
  };

  // Sort by addition order (earliest first). BeerXML TIME=X means "X min
  // before flameout" → addition at minute (boilDuration - X) of the boil.
  const events = hops
    .map((h, originalIndex) => ({
      ...h,
      originalIndex,
      additionAtMin: Math.max(0, boilDurationMin - h.time_min),
    }))
    .sort((a, b) => a.additionAtMin - b.additionAtMin);

  // The "next" highlight is the earliest unmarked addition that's either
  // already due or coming up — once you've marked it added, the highlight
  // moves to the next one.
  const nextIdx = events.findIndex((e) => !added.has(e.originalIndex));

  return (
    <div className="rounded-lg bg-bg border border-border p-4">
      <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
        {t("brew.hops.title")}
      </p>
      <ul className="space-y-2">
        {events.map((h, i) => {
          const isAdded = added.has(h.originalIndex);
          const additionAtSec = h.additionAtMin * 60;
          const remainingSec = additionAtSec - elapsedSec;
          const due = !isAdded && remainingSec <= 0;
          const isNext = !isAdded && i === nextIdx;
          return (
            <li
              key={h.originalIndex}
              className={`flex items-center justify-between gap-3 sm:gap-4 px-2 py-2 rounded ${
                isNext && due ? "bg-accent/10 ring-1 ring-accent/40" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`text-body-sm font-medium break-words ${
                    isAdded ? "text-text-muted line-through" : "text-text"
                  }`}
                >
                  {formatMassSmall({ value: h.amount_g, unit: "g" }, prefs).display} {h.name}
                  {h.alpha_acid_pct > 0 && (
                    <span className="text-text-muted font-mono text-caption ml-2">
                      {h.alpha_acid_pct.toFixed(1)}% AA
                    </span>
                  )}
                </p>
                {h.notes && (
                  <p className="text-caption text-text-muted mt-0.5">{h.notes}</p>
                )}
                <p className="font-mono text-caption text-text-muted mt-0.5">
                  {t("brew.hops.at_min", { min: h.additionAtMin })}
                  {!isAdded && !due &&
                    ` · ${t("brew.hops.in_duration", { duration: formatDuration(remainingSec) })}`}
                </p>
              </div>
              <button
                onClick={() => toggle(h.originalIndex)}
                title={isAdded ? t("brew.hops.tap_to_undo") : t("brew.hops.tap_when_added")}
                className={`shrink-0 px-3 py-2 sm:py-1.5 rounded-pill border text-caption font-medium transition-colors min-h-[36px] ${
                  isAdded
                    ? "border-success text-success bg-success/10 hover:bg-success/20"
                    : due
                    ? "border-accent text-accent bg-accent/10 hover:bg-accent/20"
                    : "border-border text-text-muted hover:border-border-strong hover:text-text"
                }`}
              >
                {isAdded ? t("brew.hops.added") : t("brew.hops.mark_added")}
              </button>
            </li>
          );
        })}
      </ul>
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
              <p className="text-caption text-text-muted capitalize">{f.type}</p>
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
                {c.form} · {c.type}
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
            <p className="text-body font-medium break-words">{step.label}</p>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 sm:mb-10">
      <h2 className="text-h3 font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

// ─── Measurements ──────────────────────────────────────────────────────────

const MEASUREMENT_KINDS: Array<{
  kind: Measurement["kind"];
  label: string;
  unit: string;
  step: number;
  // Default value for the input — pulled toward the median brewer reading.
  // Resets back to this default after a log so the next entry doesn't carry
  // the previous one's value (cheap guard against accidental re-logs).
  defaultValue: number;
}> = [
  { kind: "gravity_sg", label: "Gravity", unit: "SG", step: 0.001, defaultValue: 1.05 },
  { kind: "temperature_c", label: "Temperature", unit: "°C", step: 0.5, defaultValue: 67 },
  { kind: "ph", label: "pH", unit: "", step: 0.01, defaultValue: 5.4 },
  { kind: "volume_l", label: "Volume", unit: "L", step: 0.5, defaultValue: 25 },
  { kind: "abv_pct", label: "ABV", unit: "%", step: 0.1, defaultValue: 5.5 },
];

function MeasurementsSection({
  session,
  onAdd,
  onRemove,
  disabled,
}: {
  session: WerbSession;
  onAdd: (m: Omit<Measurement, "at">) => void;
  onRemove: (at: string) => void;
  disabled: boolean;
}) {
  const [kind, setKind] = useState<Measurement["kind"]>("gravity_sg");
  const spec = MEASUREMENT_KINDS.find((k) => k.kind === kind)!;
  const [value, setValue] = useState<number>(spec.defaultValue);
  const [notes, setNotes] = useState("");
  const localeTag = useBcp47();

  // Re-seed value when kind changes so the input is sensible for the new
  // unit (e.g. switching gravity → temperature shouldn't leave 1.050 in a °C
  // field).
  const onKindChange = (k: Measurement["kind"]) => {
    setKind(k);
    const next = MEASUREMENT_KINDS.find((x) => x.kind === k)!;
    setValue(next.defaultValue);
  };

  const measurements = session.measurements ?? [];
  const stepLabel = (stepId: string | undefined) => {
    if (!stepId) return null;
    const step = session.steps.find((s) => s.id === stepId);
    return step?.label ?? null;
  };
  const t = useT();

  const submit = () => {
    if (!Number.isFinite(value)) return;
    onAdd({ kind, value, ...(notes.trim() && { notes: notes.trim() }) });
    setValue(spec.defaultValue);
    setNotes("");
  };

  return (
    <Section title={t("brew.measurements")}>
      {!disabled && (
        <div className="rounded-xl bg-surface border border-border p-4 mb-4">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-end gap-3">
            <label className="col-span-1 sm:flex-1 sm:min-w-[10rem]">
              <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
                {t("brew.meas.reading")}
              </span>
              <select
                value={kind}
                onChange={(e) => onKindChange(e.target.value as Measurement["kind"])}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body text-text focus:outline-none focus:border-accent"
              >
                {MEASUREMENT_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {t(`brew.meas.kind.${k.kind}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-1 sm:flex-1 sm:min-w-[8rem]">
              <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
                {t("brew.meas.value")}{spec.unit && ` (${spec.unit})`}
              </span>
              <input
                type="number"
                step={spec.step}
                value={Number.isFinite(value) ? value : ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setValue(Number.isFinite(n) ? n : NaN);
                }}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body font-mono tabular-nums text-text focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </label>
            <label className="col-span-2 sm:flex-[2] sm:min-w-[12rem]">
              <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
                {t("brew.meas.notes")}
              </span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("brew.meas.notes_placeholder")}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={!Number.isFinite(value)}
              className="col-span-2 sm:col-auto w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]"
            >
              {t("brew.meas.log")}
            </button>
          </div>
        </div>
      )}

      {measurements.length === 0 ? (
        <p className="text-body-sm text-text-muted px-4">
          {disabled ? t("brew.meas.empty_disabled") : t("brew.meas.empty_active")}
        </p>
      ) : (
        <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
          {measurements.map((m) => {
            const k = MEASUREMENT_KINDS.find((x) => x.kind === m.kind);
            const label = k ? t(`brew.meas.kind.${k.kind}`) : m.kind;
            const unit = k?.unit ?? "";
            const valStr =
              m.kind === "gravity_sg"
                ? m.value.toFixed(3)
                : m.kind === "ph"
                ? m.value.toFixed(2)
                : m.value.toFixed(1);
            const stepName = stepLabel(m.step_id);
            return (
              <li
                key={m.at}
                className="px-4 py-3 flex items-baseline justify-between gap-3 sm:gap-4 hover:bg-surface-raised/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-body-sm text-text">
                    <span className="text-text-muted">{label}</span>{" "}
                    <span className="font-mono tabular-nums text-text">
                      {valStr}
                      {unit && ` ${unit}`}
                    </span>
                    {stepName && (
                      <span className="text-caption text-text-muted ml-2">
                        {t("brew.meas.during", { step: stepName })}
                      </span>
                    )}
                  </p>
                  {m.notes && (
                    <p className="text-caption text-text-muted mt-0.5">{m.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-caption text-text-muted font-mono tabular-nums">
                    {formatTimeOfDay(m.at, localeTag)}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onRemove(m.at)}
                      title={t("brew.meas.delete")}
                      className="w-7 h-7 rounded-pill flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ─── Tasting ───────────────────────────────────────────────────────────────

// Translation keys for the suggested tag chips. We surface the first
// five on the empty state; the rest are reachable by typing.
const TAG_SUGGESTION_KEYS = [
  "tasting.suggest.best",
  "tasting.suggest.too_bitter",
  "tasting.suggest.too_sweet",
  "tasting.suggest.low_body",
  "tasting.suggest.high_carb",
];

function TastingSection({
  tasting,
  onSave,
}: {
  tasting: Tasting | undefined;
  onSave: (t: Tasting | null) => void;
}) {
  // When a tasting already exists, render it in summary mode; otherwise
  // open the form. "Edit" toggles back to the form preloaded with the
  // saved values.
  const [editing, setEditing] = useState(!tasting);
  const tr = useT();

  return (
    <Section title={tr("brew.tasting")}>
      {tasting && !editing ? (
        <TastingSummary
          tasting={tasting}
          onEdit={() => setEditing(true)}
          onClear={() => {
            if (confirm(tr("tasting.remove_confirm"))) {
              onSave(null);
            }
          }}
        />
      ) : (
        <TastingForm
          initial={tasting}
          onSave={(t) => {
            onSave(t);
            setEditing(false);
          }}
          onCancel={tasting ? () => setEditing(false) : undefined}
        />
      )}
    </Section>
  );
}

function TastingForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Tasting | undefined;
  onSave: (t: Tasting) => void;
  onCancel?: (() => void) | undefined;
}) {
  const tr = useT();
  const [axes, setAxes] = useState<SensoryAxes>(initial?.axes ?? EMPTY_AXES);
  const [rating, setRating] = useState<number>(initial?.overall_rating ?? 4);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setTagDraft("");
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const submit = () => {
    onSave({
      tasted_at: initial?.tasted_at ?? new Date().toISOString(),
      axes,
      overall_rating: rating,
      ...(notes.trim() && { notes: notes.trim() }),
      ...(tags.length > 0 && { tags }),
    });
  };

  return (
    <div className="rounded-xl bg-surface border border-border p-5 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
        {/* Sliders */}
        <div className="space-y-3">
          {SENSORY_AXES.map((axis) => (
            <SliderRow
              key={axis.key}
              label={tr(axis.labelKey)}
              value={axes[axis.key]}
              onChange={(v) => setAxes({ ...axes, [axis.key]: v })}
            />
          ))}
        </div>

        {/* Live radar preview. */}
        <div className="flex justify-center md:justify-end">
          <SensoryRadar axes={axes} size={220} />
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5 space-y-5">
        <div>
          <p className="text-caption uppercase tracking-widest text-text-muted mb-2">
            {tr("tasting.overall_rating")}
          </p>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <div>
          <p className="text-caption uppercase tracking-widest text-text-muted mb-2">
            {tr("tasting.tags")}{" "}
            <span className="text-text-muted normal-case">{tr("tasting.tags_hint")}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeTag(tag)}
                title={tr("tasting.remove_tag")}
                className="px-3 py-1 rounded-pill bg-accent/20 text-accent text-caption font-medium hover:bg-accent/30 transition-colors"
              >
                {tag} <span aria-hidden className="ml-1 opacity-60">×</span>
              </button>
            ))}
            <input
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagDraft);
                }
              }}
              onBlur={() => addTag(tagDraft)}
              placeholder={tr("tasting.tag_placeholder")}
              className="flex-1 min-w-[10rem] bg-bg border border-border rounded-pill px-3 py-1 text-caption text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          {tags.length === 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {TAG_SUGGESTION_KEYS.map((key) => {
                const label = tr(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => addTag(label)}
                    className="px-3 py-1 rounded-pill bg-bg border border-border border-dashed text-caption text-text-muted hover:text-text hover:border-accent transition-colors"
                  >
                    + {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="text-caption uppercase tracking-widest text-text-muted mb-2">
            {tr("tasting.notes")}
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={tr("tasting.notes_placeholder")}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-wrap gap-3 justify-end pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-lg bg-surface-raised border border-border text-body-sm font-medium text-text-muted hover:text-text transition-colors min-h-[40px]"
            >
              {tr("tasting.cancel")}
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            className="px-5 py-2.5 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity min-h-[40px]"
          >
            {tr("tasting.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TastingSummary({
  tasting,
  onEdit,
  onClear,
}: {
  tasting: Tasting;
  onEdit: () => void;
  onClear: () => void;
}) {
  const t = useT();
  const localeTag = useBcp47();
  return (
    <div className="rounded-xl bg-surface border border-border p-5 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <StarRating value={tasting.overall_rating} readOnly />
            <p className="font-mono text-caption text-text-muted">
              {new Date(tasting.tasted_at).toLocaleDateString(localeTag, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          {tasting.tags && tasting.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tasting.tags.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 rounded-pill bg-accent/15 text-accent text-caption font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {tasting.notes && (
            <p className="mt-4 text-body-sm text-text whitespace-pre-wrap">
              {tasting.notes}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onEdit}
              className="px-4 py-2 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent transition-colors"
            >
              {t("tasting.edit")}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="px-4 py-2 rounded-lg text-caption text-text-muted hover:text-danger transition-colors"
            >
              {t("tasting.remove")}
            </button>
          </div>
        </div>

        <div className="flex justify-center md:justify-end">
          <SensoryRadar axes={tasting.axes} size={200} />
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[5rem_1fr_2.5rem] items-center gap-3">
      <span className="text-caption uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={5}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
      <span className="font-mono text-body-sm tabular-nums text-right">
        {value.toFixed(1)}
      </span>
    </label>
  );
}

function StarRating({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  const t = useT();
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={t("brew.tasting.aria_rating")}>
      {stars.map((n) => {
        const filled = n <= value;
        const className = `text-h3 leading-none transition-colors ${
          filled ? "text-accent" : "text-text-muted"
        } ${readOnly ? "" : "hover:text-accent cursor-pointer"}`;
        if (readOnly) {
          return (
            <span key={n} aria-hidden className={className}>
              ★
            </span>
          );
        }
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange?.(n)}
            className={className}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

function formatTimeOfDay(iso: string, localeTag: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });
}


function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const t = Math.abs(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}
